// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
import {
  guestAction,
  logInAction,
  logOutAction,
  signUpAction,
} from "../app/actions/auth";
import * as auth from "../lib/auth";

const cookieStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };

vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("../lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof auth>()),
  signUp: vi.fn(),
  logIn: vi.fn(),
  createGuest: vi.fn(),
  createSession: vi.fn(),
  invalidateSession: vi.fn(),
}));

const aUser = {
  id: "user-1",
  username: "alex",
  passwordHash: "hash",
  isGuest: false,
  createdAt: new Date(),
};
const expiresAt = new Date("2026-10-29T00:00:00Z");

function form(username: string, password: string) {
  const data = new FormData();
  data.set("username", username);
  data.set("password", password);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.createSession).mockResolvedValue({ token: "jeton", expiresAt });
});

test("Should_ReturnErrorWithoutCreatingUser_When_SignUpInputIsInvalid", async () => {
  const state = await signUpAction(undefined, form("ab", "motdepasse123"));

  expect(state).toEqual({
    error: "Le nom d'utilisateur doit avoir au moins 3 caractères.",
    username: "ab",
  });
  expect(auth.signUp).not.toHaveBeenCalled();
});

test("Should_ReturnError_When_UsernameIsTaken", async () => {
  vi.mocked(auth.signUp).mockResolvedValue("taken");

  const state = await signUpAction(undefined, form("alex", "motdepasse123"));

  expect(state?.error).toBe("Ce nom d'utilisateur est déjà pris.");
  expect(cookieStore.set).not.toHaveBeenCalled();
});

test("Should_SetHttpOnlySessionCookieAndRedirect_When_SignUpSucceeds", async () => {
  vi.mocked(auth.signUp).mockResolvedValue(aUser);

  await expect(
    signUpAction(undefined, form("alex", "motdepasse123")),
  ).rejects.toThrow("NEXT_REDIRECT");

  expect(auth.createSession).toHaveBeenCalledWith("user-1");
  expect(cookieStore.set).toHaveBeenCalledWith(
    "session",
    "jeton",
    expect.objectContaining({ httpOnly: true, sameSite: "lax", expires: expiresAt }),
  );
});

test("Should_ReturnGenericError_When_LogInFails", async () => {
  vi.mocked(auth.logIn).mockResolvedValue(null);

  const state = await logInAction(undefined, form("alex", "mauvais"));

  expect(state).toEqual({
    error: "Nom d'utilisateur ou mot de passe incorrect.",
    username: "alex",
  });
  expect(cookieStore.set).not.toHaveBeenCalled();
});

test("Should_SetSessionCookie_When_LogInSucceeds", async () => {
  vi.mocked(auth.logIn).mockResolvedValue(aUser);

  await expect(
    logInAction(undefined, form("alex", "motdepasse123")),
  ).rejects.toThrow("NEXT_REDIRECT");

  expect(cookieStore.set).toHaveBeenCalledWith(
    "session",
    "jeton",
    expect.objectContaining({ httpOnly: true }),
  );
});

test("Should_CreateGuestSession_When_PlayingAsGuest", async () => {
  vi.mocked(auth.createGuest).mockResolvedValue({
    ...aUser,
    id: "guest-1",
    isGuest: true,
  });

  await expect(guestAction()).rejects.toThrow("NEXT_REDIRECT");

  expect(auth.createSession).toHaveBeenCalledWith("guest-1");
  expect(cookieStore.set).toHaveBeenCalled();
});

test("Should_InvalidateSessionAndDeleteCookie_When_LoggingOut", async () => {
  cookieStore.get.mockReturnValue({ value: "jeton" });

  await expect(logOutAction()).rejects.toThrow("NEXT_REDIRECT");

  expect(auth.invalidateSession).toHaveBeenCalledWith("jeton");
  expect(cookieStore.delete).toHaveBeenCalledWith("session");
});
