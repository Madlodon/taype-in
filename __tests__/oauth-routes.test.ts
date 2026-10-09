// @vitest-environment node
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as start } from "../app/auth/[provider]/route";
import { GET as callback } from "../app/auth/[provider]/callback/route";
import * as auth from "../lib/auth";
import * as oauth from "../lib/oauth";

const cookieStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };

vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
// Le vrai redirect lance une erreur ; on garde l'adresse pour la vérifier.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock("../lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof auth>()),
  createSession: vi.fn(),
}));
vi.mock("../lib/oauth", async (importOriginal) => ({
  ...(await importOriginal<typeof oauth>()),
  fetchProfile: vi.fn(),
  findOAuthUser: vi.fn(),
}));

const expiresAt = new Date("2026-11-08T00:00:00Z");
const profile = { provider: "github" as const, id: "42", username: "octo-cat", avatarUrl: "https://avatars.example/42" };

function params(provider: string) {
  return { params: Promise.resolve({ provider }) };
}

async function redirectOf(response: Promise<unknown>) {
  const error = (await response.catch((e: Error) => e)) as Error;
  return error.message.replace("NEXT_REDIRECT ", "");
}

// Le cookie que la route de départ aurait posé.
function savedState(state = "etat", next = "/lobbies", provider = "github") {
  cookieStore.get.mockImplementation((name: string) =>
    name === oauth.STATE_COOKIE ? { value: JSON.stringify({ provider, state, next }) } : undefined,
  );
}

function callbackRequest(query: string) {
  return callback(new NextRequest(`http://localhost:3000/auth/github/callback?${query}`), params("github"));
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockReturnValue(undefined);
  vi.stubEnv("PASSWORD_PEPPER", "poivre-de-test");
  vi.stubEnv("GITHUB_CLIENT_ID", "github-id");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "github-secret");
  vi.mocked(auth.createSession).mockResolvedValue({ token: "jeton", expiresAt });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test("Should_SetStateCookieAndRedirectToProvider_When_LoginStarts", async () => {
  const url = await redirectOf(start(new NextRequest("http://localhost:3000/auth/github?next=/invite/abc"), params("github")));

  const [name, value, options] = cookieStore.set.mock.calls[0];
  const saved = JSON.parse(value);
  expect(name).toBe(oauth.STATE_COOKIE);
  expect(saved).toMatchObject({ provider: "github", next: "/invite/abc" });
  expect(options).toMatchObject({ httpOnly: true, sameSite: "lax" });
  expect(new URL(url).searchParams.get("state")).toBe(saved.state);
  expect(new URL(url).searchParams.get("redirect_uri")).toBe("http://localhost:3000/auth/github/callback");
});

test("Should_UsePublicAppUrlInRedirectUri_When_AppUrlIsSet", async () => {
  vi.stubEnv("APP_URL", "https://laniproject.dev");

  const url = await redirectOf(start(new NextRequest("http://localhost:3000/auth/github"), params("github")));

  expect(new URL(url).searchParams.get("redirect_uri")).toBe("https://laniproject.dev/auth/github/callback");
});

test("Should_IgnoreExternalNext_When_LoginStarts", async () => {
  await redirectOf(start(new NextRequest("http://localhost:3000/auth/github?next=//evil.example"), params("github")));

  expect(JSON.parse(cookieStore.set.mock.calls[0][1]).next).toBe("/");
});

test.each(["discord", "twitter"])("Should_Return404_When_ProviderIsNotConfigured %s", async (provider) => {
  const response = await start(new NextRequest(`http://localhost:3000/auth/${provider}`), params(provider));

  expect(response?.status).toBe(404);
});

test("Should_LogInAndRedirectToNext_When_AccountIsAlreadyLinked", async () => {
  savedState();
  vi.mocked(oauth.fetchProfile).mockResolvedValue(profile);
  vi.mocked(oauth.findOAuthUser).mockResolvedValue({ id: "user-1" } as auth.User);

  expect(await redirectOf(callbackRequest("code=abc&state=etat"))).toBe("/lobbies");
  expect(auth.createSession).toHaveBeenCalledWith("user-1");
  expect(cookieStore.set).toHaveBeenCalledWith(auth.SESSION_COOKIE, "jeton", expect.objectContaining({ httpOnly: true, expires: expiresAt }));
  expect(cookieStore.delete).toHaveBeenCalledWith(oauth.STATE_COOKIE);
});

test("Should_KeepProfileInPendingCookieAndAskForUsername_When_AccountIsNew", async () => {
  savedState();
  vi.mocked(oauth.fetchProfile).mockResolvedValue(profile);
  vi.mocked(oauth.findOAuthUser).mockResolvedValue(null);

  expect(await redirectOf(callbackRequest("code=abc&state=etat"))).toBe("/signup/oauth");
  const [name, value] = cookieStore.set.mock.calls[0];
  expect(name).toBe(oauth.PENDING_COOKIE);
  expect(oauth.decodePending(value)).toEqual({
    provider: "github",
    id: "42",
    avatarUrl: "https://avatars.example/42",
    username: "octo_cat",
    next: "/lobbies",
  });
  expect(auth.createSession).not.toHaveBeenCalled();
});

test("Should_ExchangeCodeWithSameRedirectUri_When_ProviderRedirectsBack", async () => {
  savedState();
  vi.mocked(oauth.fetchProfile).mockResolvedValue(null);

  await redirectOf(callbackRequest("code=abc&state=etat"));

  expect(oauth.fetchProfile).toHaveBeenCalledWith("github", "abc", "http://localhost:3000/auth/github/callback");
});

test.each([
  ["state differs", "code=abc&state=autre", () => savedState()],
  ["state cookie is missing", "code=abc&state=etat", () => {}],
  ["player denied access", "error=access_denied&state=etat", () => savedState()],
  ["state was for another provider", "code=abc&state=etat", () => savedState("etat", "/", "discord")],
])("Should_RedirectToLoginWithError_When %s", async (_case, query, setup) => {
  setup();

  expect(await redirectOf(callbackRequest(query))).toBe("/login?error=oauthFailed");
  expect(oauth.fetchProfile).not.toHaveBeenCalled();
  expect(auth.createSession).not.toHaveBeenCalled();
});

test("Should_RedirectToLoginWithError_When_ProviderRejectsCode", async () => {
  savedState();
  vi.mocked(oauth.fetchProfile).mockResolvedValue(null);

  expect(await redirectOf(callbackRequest("code=abc&state=etat"))).toBe("/login?error=oauthFailed");
  expect(auth.createSession).not.toHaveBeenCalled();
});
