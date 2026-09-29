// @vitest-environment node
import { createHash } from "node:crypto";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";
import { sessions, users } from "../db/schema";
import {
  createGuest,
  createSession,
  credentialsSchema,
  invalidateSession,
  logIn,
  signUp,
  validateSessionToken,
  type User,
} from "../lib/auth";

const DAY_MS = 24 * 60 * 60 * 1000;

// Utilisateurs créés par un test, supprimés après (avec leurs sessions).
const createdIds: string[] = [];

function uniqueName() {
  return `t_${Math.random().toString(36).slice(2, 12)}`;
}

async function newAccount(username = uniqueName(), password = "motdepasse123") {
  const user = (await signUp(username, password)) as User;
  createdIds.push(user.id);
  return user;
}

async function setExpiry(token: string, expiresAt: Date) {
  const id = createHash("sha256").update(token).digest("hex");
  await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "db/migrations" });
});

afterEach(async () => {
  if (createdIds.length === 0) return;
  await db.delete(users).where(inArray(users.id, createdIds.splice(0)));
});

afterAll(async () => {
  await db.$client.end();
});

test("Should_AcceptCredentials_When_UsernameAndPasswordAreValid", () => {
  expect(
    credentialsSchema.safeParse({ username: "Alex_42", password: "123456789012" })
      .success,
  ).toBe(true);
});

test.each([
  ["username has 2 chars", { username: "ab", password: "123456789012" }],
  ["username has 21 chars", { username: "a".repeat(21), password: "123456789012" }],
  ["username has an accent", { username: "élise", password: "123456789012" }],
  ["username has a space", { username: "a b c", password: "123456789012" }],
  ["username has a dash", { username: "Invité-123", password: "123456789012" }],
  ["password has 11 chars", { username: "alex", password: "12345678901" }],
  ["password has 129 chars", { username: "alex", password: "a".repeat(129) }],
])("Should_RejectCredentials_When_%s", (_label, input) => {
  expect(credentialsSchema.safeParse(input).success).toBe(false);
});

test("Should_AcceptCredentials_When_LengthsAreAtBounds", () => {
  expect(
    credentialsSchema.safeParse({ username: "abc", password: "123456789012" })
      .success,
  ).toBe(true);
  expect(
    credentialsSchema.safeParse({
      username: "a".repeat(20),
      password: "a".repeat(128),
    }).success,
  ).toBe(true);
});

test("Should_HashPassword_When_AccountIsCreated", async () => {
  const user = await newAccount(undefined, "motdepasse123");

  expect(user.isGuest).toBe(false);
  expect(user.passwordHash).not.toBe("motdepasse123");
  expect(user.passwordHash).toMatch(/^\$argon2id\$/);
});

test("Should_ReturnTaken_When_UsernameExistsWithDifferentCase", async () => {
  const user = await newAccount();

  expect(await signUp(user.username.toUpperCase(), "autremotdepasse")).toBe(
    "taken",
  );
});

test("Should_ReturnUser_When_PasswordIsCorrect", async () => {
  const user = await newAccount(undefined, "motdepasse123");

  expect((await logIn(user.username, "motdepasse123"))?.id).toBe(user.id);
});

test("Should_ReturnUser_When_UsernameCaseDiffers", async () => {
  const user = await newAccount(undefined, "motdepasse123");

  expect((await logIn(user.username.toUpperCase(), "motdepasse123"))?.id).toBe(
    user.id,
  );
});

test("Should_ReturnNull_When_PasswordIsWrong", async () => {
  const user = await newAccount(undefined, "motdepasse123");

  expect(await logIn(user.username, "mauvaispass")).toBeNull();
});

test("Should_ReturnNull_When_UserDoesNotExist", async () => {
  expect(await logIn(uniqueName(), "motdepasse123")).toBeNull();
});

test("Should_CreateGuestWithoutPassword_When_GuestIsCreated", async () => {
  const guest = await createGuest();
  createdIds.push(guest.id);

  expect(guest.isGuest).toBe(true);
  expect(guest.passwordHash).toBeNull();
  expect(guest.username).toMatch(/^Invité-\d{6}$/);
});

test("Should_ReturnNull_When_GuestTriesToLogIn", async () => {
  const guest = await createGuest();
  createdIds.push(guest.id);

  expect(await logIn(guest.username, "")).toBeNull();
});

test("Should_ReturnUser_When_SessionTokenIsValid", async () => {
  const user = await newAccount();
  const { token } = await createSession(user.id);

  expect((await validateSessionToken(token))?.id).toBe(user.id);
});

test("Should_StoreHashOnly_When_SessionIsCreated", async () => {
  const user = await newAccount();
  const { token } = await createSession(user.id);

  const [row] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, user.id));
  expect(row.id).not.toBe(token);
});

test("Should_ExpireIn30Days_When_SessionIsCreated", async () => {
  const user = await newAccount();
  const before = Date.now();

  const { expiresAt } = await createSession(user.id);

  expect(expiresAt.getTime() - before).toBeGreaterThanOrEqual(30 * DAY_MS);
  expect(expiresAt.getTime() - before).toBeLessThan(30 * DAY_MS + 5_000);
});

test("Should_ReturnNull_When_TokenIsUnknown", async () => {
  expect(await validateSessionToken("jeton-inconnu")).toBeNull();
});

test("Should_ReturnNullAndDeleteSession_When_SessionIsExpired", async () => {
  const user = await newAccount();
  const { token } = await createSession(user.id);
  await setExpiry(token, new Date(Date.now() - 1000));

  expect(await validateSessionToken(token)).toBeNull();
  expect(
    await db.select().from(sessions).where(eq(sessions.userId, user.id)),
  ).toHaveLength(0);
});

test("Should_ExtendSession_When_LessThan15DaysRemain", async () => {
  const user = await newAccount();
  const { token } = await createSession(user.id);
  await setExpiry(token, new Date(Date.now() + 10 * DAY_MS));

  await validateSessionToken(token);

  const [row] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, user.id));
  expect(row.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * DAY_MS);
});

test("Should_ReturnNull_When_SessionWasInvalidated", async () => {
  const user = await newAccount();
  const { token } = await createSession(user.id);

  await invalidateSession(token);

  expect(await validateSessionToken(token)).toBeNull();
});
