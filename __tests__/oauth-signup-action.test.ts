// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { oauthSignUpAction } from "../app/actions/auth";
import * as auth from "../lib/auth";
import * as oauth from "../lib/oauth";

const cookieStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };

vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock("../lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof auth>()),
  createSession: vi.fn(),
  invalidateSession: vi.fn(),
  validateSessionToken: vi.fn(),
}));
vi.mock("../lib/oauth", async (importOriginal) => ({
  ...(await importOriginal<typeof oauth>()),
  findOAuthUser: vi.fn(),
  signUpWithOAuth: vi.fn(),
}));

const pending = { provider: "discord" as const, id: "123", avatarUrl: null, username: "alex_m", next: "/lobbies" };
const aUser = { id: "user-1", username: "alex_m", isGuest: false } as auth.User;

// Cookies du navigateur : le compte externe en attente et, au besoin, la session.
function browserCookies({ pendingValue = oauth.encodePending(pending), session }: { pendingValue?: string; session?: string }) {
  cookieStore.get.mockImplementation((name: string) => {
    if (name === oauth.PENDING_COOKIE) return { value: pendingValue };
    if (name === auth.SESSION_COOKIE && session) return { value: session };
    return undefined;
  });
}

function form(username: string) {
  const data = new FormData();
  data.set("username", username);
  return data;
}

async function redirectOf(result: Promise<unknown>) {
  const error = (await result.catch((e: Error) => e)) as Error;
  return error.message.replace("NEXT_REDIRECT ", "");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PASSWORD_PEPPER", "poivre-de-test");
  vi.mocked(auth.createSession).mockResolvedValue({ token: "jeton", expiresAt: new Date("2026-11-08T00:00:00Z") });
  vi.mocked(oauth.findOAuthUser).mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test("Should_CreateAccountStartSessionAndReturnToNext_When_UsernameIsValid", async () => {
  browserCookies({});
  vi.mocked(oauth.signUpWithOAuth).mockResolvedValue(aUser);

  expect(await redirectOf(oauthSignUpAction(undefined, form("alex_m")))).toBe("/lobbies");
  expect(oauth.signUpWithOAuth).toHaveBeenCalledWith(pending, "alex_m", undefined);
  expect(auth.createSession).toHaveBeenCalledWith("user-1");
  expect(cookieStore.set).toHaveBeenCalledWith(auth.SESSION_COOKIE, "jeton", expect.objectContaining({ httpOnly: true }));
  expect(cookieStore.delete).toHaveBeenCalledWith(oauth.PENDING_COOKIE);
});

test("Should_ReturnErrorWithoutCreatingAccount_When_UsernameIsInvalid", async () => {
  browserCookies({});

  expect(await oauthSignUpAction(undefined, form("a.b"))).toEqual({ error: "usernameInvalid", username: "a.b" });
  expect(oauth.signUpWithOAuth).not.toHaveBeenCalled();
});

test("Should_ReturnTakenError_When_UsernameExists", async () => {
  browserCookies({});
  vi.mocked(oauth.signUpWithOAuth).mockResolvedValue("taken");

  expect(await oauthSignUpAction(undefined, form("alex_m"))).toEqual({ error: "usernameTaken", username: "alex_m" });
  expect(auth.createSession).not.toHaveBeenCalled();
  expect(cookieStore.delete).not.toHaveBeenCalled();
});

test("Should_UpgradeGuestAndRenewSession_When_GuestFinishesOAuthSignUp", async () => {
  browserCookies({ session: "jeton-invite" });
  vi.mocked(auth.validateSessionToken).mockResolvedValue({ ...aUser, id: "guest-1", isGuest: true });
  vi.mocked(oauth.signUpWithOAuth).mockResolvedValue({ ...aUser, id: "guest-1" });

  await redirectOf(oauthSignUpAction(undefined, form("alex_m")));

  expect(oauth.signUpWithOAuth).toHaveBeenCalledWith(pending, "alex_m", "guest-1");
  expect(auth.invalidateSession).toHaveBeenCalledWith("jeton-invite");
  expect(auth.createSession).toHaveBeenCalledWith("guest-1");
});

test("Should_LogInWithoutCreatingAgain_When_AccountWasAlreadyCreated", async () => {
  browserCookies({});
  vi.mocked(oauth.findOAuthUser).mockResolvedValue(aUser);

  expect(await redirectOf(oauthSignUpAction(undefined, form("autre")))).toBe("/lobbies");
  expect(oauth.signUpWithOAuth).not.toHaveBeenCalled();
  expect(auth.createSession).toHaveBeenCalledWith("user-1");
});

test.each([
  ["missing", undefined],
  ["forged", "abc.def"],
])("Should_RedirectToLoginWithError_When_PendingCookieIs %s", async (_case, pendingValue) => {
  cookieStore.get.mockReturnValue(pendingValue ? { value: pendingValue } : undefined);

  expect(await redirectOf(oauthSignUpAction(undefined, form("alex_m")))).toBe("/login?error=oauthFailed");
  expect(oauth.signUpWithOAuth).not.toHaveBeenCalled();
});
