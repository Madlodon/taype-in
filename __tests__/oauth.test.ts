// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import sharp from "sharp";
import { db } from "../db";
import { avatars, oauthAccounts, users } from "../db/schema";
import { createGuest } from "../lib/auth";
import { getAvatarVersion } from "../lib/avatars";
import {
  authorizeUrl,
  decodePending,
  enabledProviders,
  encodePending,
  fetchProfile,
  findOAuthUser,
  PENDING_DURATION_MS,
  signUpWithOAuth,
  suggestUsername,
} from "../lib/oauth";

const createdIds: string[] = [];
const REDIRECT = "http://localhost:3000/auth/github/callback";

function uniqueName() {
  return `t_${Math.random().toString(36).slice(2, 12)}`;
}

function uniqueId() {
  return String(Math.floor(Math.random() * 1e12));
}

// Faux fournisseur : chaque URL appelée renvoie la réponse prévue.
function mockProvider(routes: Record<string, Response | (() => Response)>) {
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    const match = Object.keys(routes).find((prefix) => url.startsWith(prefix));
    if (!match) return new Response("not found", { status: 404 });
    const route = routes[match];
    return typeof route === "function" ? route() : route.clone();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function png() {
  return sharp({ create: { width: 40, height: 40, channels: 3, background: "#1d4ed8" } }).png().toBuffer();
}

async function signUp(...args: Parameters<typeof signUpWithOAuth>) {
  const user = await signUpWithOAuth(...args);
  if (user !== "taken") createdIds.push(user.id);
  return user;
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "db/migrations" });
});

beforeEach(() => {
  vi.stubEnv("PASSWORD_PEPPER", "poivre-de-test");
  vi.stubEnv("DISCORD_CLIENT_ID", "discord-id");
  vi.stubEnv("DISCORD_CLIENT_SECRET", "discord-secret");
  vi.stubEnv("GITHUB_CLIENT_ID", "github-id");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "github-secret");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  if (createdIds.length) await db.delete(users).where(inArray(users.id, createdIds.splice(0)));
});

afterAll(async () => {
  await db.$client.end();
});

test("Should_OfferOnlyConfiguredProviders_When_KeysAreMissing", () => {
  vi.stubEnv("DISCORD_CLIENT_SECRET", "");

  expect(enabledProviders()).toEqual(["github"]);
});

test("Should_BuildAuthorizeUrlWithClientIdRedirectAndState_When_StartingDiscordLogin", () => {
  const url = new URL(authorizeUrl("discord", "http://localhost:3000/auth/discord/callback", "etat"));

  expect(url.origin + url.pathname).toBe("https://discord.com/oauth2/authorize");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    client_id: "discord-id",
    redirect_uri: "http://localhost:3000/auth/discord/callback",
    response_type: "code",
    scope: "identify",
    state: "etat",
  });
});

test("Should_ExchangeCodeAndReadGitHubProfile_When_CodeIsValid", async () => {
  const fetchMock = mockProvider({
    "https://github.com/login/oauth/access_token": Response.json({ access_token: "jeton" }),
    "https://api.github.com/user": Response.json({ id: 42, login: "octo-cat", avatar_url: "https://avatars.example/42" }),
  });

  const profile = await fetchProfile("github", "code-1", REDIRECT);

  expect(profile).toEqual({ provider: "github", id: "42", username: "octo-cat", avatarUrl: "https://avatars.example/42" });
  const body = fetchMock.mock.calls[0][1]!.body as URLSearchParams;
  expect(body.get("code")).toBe("code-1");
  expect(body.get("client_secret")).toBe("github-secret");
  expect(body.get("redirect_uri")).toBe(REDIRECT);
  expect(new Headers(fetchMock.mock.calls[1][1]!.headers).get("Authorization")).toBe("Bearer jeton");
});

test("Should_BuildDiscordCdnAvatarUrl_When_DiscordUserHasAvatar", async () => {
  mockProvider({
    "https://discord.com/api/oauth2/token": Response.json({ access_token: "jeton" }),
    "https://discord.com/api/users/@me": Response.json({ id: "123", username: "alex.m", avatar: "abc" }),
  });

  const profile = await fetchProfile("discord", "code", REDIRECT);

  expect(profile).toEqual({
    provider: "discord",
    id: "123",
    username: "alex.m",
    avatarUrl: "https://cdn.discordapp.com/avatars/123/abc.png?size=256",
  });
});

test("Should_HaveNoAvatarUrl_When_DiscordUserHasNoAvatar", async () => {
  mockProvider({
    "https://discord.com/api/oauth2/token": Response.json({ access_token: "jeton" }),
    "https://discord.com/api/users/@me": Response.json({ id: "123", username: "alex", avatar: null }),
  });

  expect((await fetchProfile("discord", "code", REDIRECT))?.avatarUrl).toBeNull();
});

test("Should_ReturnNull_When_ProviderRejectsTheCode", async () => {
  mockProvider({
    "https://github.com/login/oauth/access_token": Response.json({ error: "bad_verification_code" }),
  });

  expect(await fetchProfile("github", "vieux-code", REDIRECT)).toBeNull();
});

test("Should_ReturnNull_When_TokenRequestFails", async () => {
  mockProvider({ "https://discord.com/api/oauth2/token": new Response("", { status: 400 }) });

  expect(await fetchProfile("discord", "code", REDIRECT)).toBeNull();
});

test.each([
  ["alex.martin", "alex_martin"],
  ["octo-cat", "octo_cat"],
  ["a".repeat(30), "a".repeat(20)],
  ["Élise", "_lise"],
])("Should_SuggestValidUsername_When_ProviderNameIs %s", (name, expected) => {
  expect(suggestUsername(name)).toBe(expected);
});

test("Should_CreatePasswordlessAccountLinkedToProvider_When_SigningUpWithOAuth", async () => {
  const id = uniqueId();
  const username = uniqueName();

  const user = await signUp({ provider: "github", id, avatarUrl: null }, username);

  expect(user).toMatchObject({ username, passwordHash: null, isGuest: false });
  expect((await findOAuthUser("github", id))?.username).toBe(username);
});

test("Should_FindNoUser_When_AccountIsLinkedToOtherProvider", async () => {
  const id = uniqueId();
  await signUp({ provider: "github", id, avatarUrl: null }, uniqueName());

  expect(await findOAuthUser("discord", id)).toBeNull();
});

test("Should_KeepGuestRow_When_GuestSignsUpWithOAuth", async () => {
  const guest = await createGuest();
  createdIds.push(guest.id);
  const username = uniqueName();

  const user = await signUp({ provider: "discord", id: uniqueId(), avatarUrl: null }, username, guest.id);

  expect(user).toMatchObject({ id: guest.id, username, isGuest: false });
});

test("Should_ReturnTakenAndNotLinkAccount_When_UsernameExists", async () => {
  const username = uniqueName();
  await signUp({ provider: "github", id: uniqueId(), avatarUrl: null }, username);
  const id = uniqueId();

  expect(await signUp({ provider: "github", id, avatarUrl: null }, username.toUpperCase())).toBe("taken");
  expect(await db.select().from(oauthAccounts).where(eq(oauthAccounts.providerUserId, id))).toEqual([]);
});

test("Should_CopyProviderPhotoAsAvatar_When_AccountIsCreated", async () => {
  mockProvider({ "https://avatars.example/": new Response(new Uint8Array(await png())) });

  const user = await signUp({ provider: "github", id: uniqueId(), avatarUrl: "https://avatars.example/1" }, uniqueName());

  const [avatar] = await db.select().from(avatars).where(eq(avatars.userId, (user as { id: string }).id));
  expect(avatar.contentType).toBe("image/webp");
});

test("Should_CreateAccountWithoutPhoto_When_PhotoDownloadFails", async () => {
  mockProvider({ "https://avatars.example/": new Response("", { status: 500 }) });

  const user = await signUp({ provider: "github", id: uniqueId(), avatarUrl: "https://avatars.example/1" }, uniqueName());

  expect(user).not.toBe("taken");
  expect(await getAvatarVersion((user as { id: string }).id)).toBeNull();
});

const pending = { provider: "github" as const, id: "42", avatarUrl: null, username: "octo_cat", next: "/lobbies" };

test("Should_ReadBackPendingSignUp_When_CookieIsUntouched", () => {
  expect(decodePending(encodePending(pending))).toEqual(pending);
});

test("Should_RejectPendingSignUp_When_PayloadIsTampered", () => {
  const [, signature] = encodePending(pending).split(".");
  const forged = Buffer.from(JSON.stringify({ ...pending, id: "1", expiresAt: Date.now() + 60_000 })).toString("base64url");

  expect(decodePending(`${forged}.${signature}`)).toBeNull();
});

test.each([undefined, "", "pas-un-cookie", "a.b"])("Should_RejectPendingSignUp_When_CookieIs %s", (value) => {
  expect(decodePending(value)).toBeNull();
});

test("Should_RejectPendingSignUp_When_ItExpired", () => {
  vi.useFakeTimers();
  const value = encodePending(pending);
  vi.advanceTimersByTime(PENDING_DURATION_MS + 1);

  expect(decodePending(value)).toBeNull();
});
