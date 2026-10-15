// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";
import { users } from "../db/schema";
import { signUp, type User } from "../lib/auth";
import { signUpWithOAuth } from "../lib/oauth";
import {
  changeUsername,
  findRenamedUser,
  isUsernameReserved,
  nextRenameAt,
  RENAME_COOLDOWN_MS,
  revertUsername,
  revertUntil,
} from "../lib/username";

const DAY_MS = 24 * 60 * 60 * 1000;
const createdIds: string[] = [];

function uniqueName() {
  return `t_${Math.random().toString(36).slice(2, 12)}`;
}

async function newAccount(username = uniqueName()) {
  const user = (await signUp(username, "motdepasse123")) as User;
  createdIds.push(user.id);
  return user;
}

// Fait comme si le dernier changement datait de daysAgo jours.
async function renamedDaysAgo(user: User, daysAgo: number): Promise<User> {
  const [updated] = await db
    .update(users)
    .set({ renamedAt: new Date(Date.now() - daysAgo * DAY_MS) })
    .where(eq(users.id, user.id))
    .returning();
  return updated;
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "db/migrations" });
});

beforeEach(() => {
  vi.stubEnv("PASSWORD_PEPPER", "poivre-de-test");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  if (createdIds.length === 0) return;
  await db.delete(users).where(inArray(users.id, createdIds.splice(0)));
});

afterAll(async () => {
  await db.$client.end();
});

test("Should_RenameAndReserveOldName_When_FirstChange", async () => {
  const user = await newAccount();
  const newName = uniqueName();

  const renamed = (await changeUsername(user, newName)) as User;

  expect(renamed.username).toBe(newName);
  expect(renamed.previousUsername).toBe(user.username);
  expect(renamed.renamedAt).toBeInstanceOf(Date);
  expect(await isUsernameReserved(user.username)).toBe(true);
});

test("Should_RefuseChange_When_LastChangeWasLessThan30DaysAgo", async () => {
  const user = await renamedDaysAgo(await newAccount(), 29);

  expect(await changeUsername(user, uniqueName())).toBe("cooldown");
});

test("Should_AllowChange_When_LastChangeWasMoreThan30DaysAgo", async () => {
  const user = await renamedDaysAgo(await newAccount(), 31);
  const newName = uniqueName();

  expect(((await changeUsername(user, newName)) as User).username).toBe(newName);
});

test("Should_RefuseChange_When_NameIsUnchanged", async () => {
  const user = await newAccount();

  expect(await changeUsername(user, user.username)).toBe("same");
});

test("Should_AllowCaseOnlyChange_When_NameDiffersByCase", async () => {
  const user = await newAccount();

  expect(((await changeUsername(user, user.username.toUpperCase())) as User).username).toBe(
    user.username.toUpperCase(),
  );
});

test("Should_RefuseChange_When_AnotherAccountHasTheName", async () => {
  const other = await newAccount();
  const user = await newAccount();

  expect(await changeUsername(user, other.username.toUpperCase())).toBe("taken");
});

test("Should_RefuseReservedName_When_AnotherUserTakesIt", async () => {
  const owner = await newAccount();
  const oldName = owner.username;
  await changeUsername(owner, uniqueName());
  const user = await newAccount();

  expect(await changeUsername(user, oldName)).toBe("taken");
  expect(await signUp(oldName.toUpperCase(), "motdepasse123")).toBe("taken");
  expect(await signUpWithOAuth({ provider: "github", id: uniqueName(), avatarUrl: null }, oldName)).toBe("taken");
});

test("Should_FreeOldName_When_ReservationIsOver", async () => {
  const owner = await newAccount();
  const oldName = owner.username;
  const renamed = await renamedDaysAgo((await changeUsername(owner, uniqueName())) as User, 31);

  expect(revertUntil(renamed)).toBeNull();
  expect(await revertUsername(renamed)).toBeNull();
  expect(await findRenamedUser(oldName)).toBeNull();
  expect(((await newAccount(oldName)) as User).username).toBe(oldName);
});

test("Should_RestoreOldNameWithoutNewCooldown_When_OwnerReverts", async () => {
  const user = await newAccount();
  const newName = uniqueName();
  const renamed = (await changeUsername(user, newName)) as User;

  const reverted = (await revertUsername(renamed)) as User;

  expect(reverted.username).toBe(user.username);
  expect(reverted.previousUsername).toBeNull();
  expect(reverted.renamedAt).toEqual(renamed.renamedAt);
  expect(await changeUsername(reverted, uniqueName())).toBe("cooldown");
  // Le nom quitté redevient libre pour tout le monde.
  expect(await isUsernameReserved(newName)).toBe(false);
});

test("Should_RefuseRevert_When_UserNeverRenamed", async () => {
  const user = await newAccount();

  expect(await revertUsername(user)).toBeNull();
});

test("Should_FindNewName_When_OldNameWasLeftWithin30Days", async () => {
  const user = await newAccount();
  const newName = uniqueName();
  await changeUsername(user, newName);

  expect((await findRenamedUser(user.username.toUpperCase()))?.username).toBe(newName);
});

test("Should_ComputeDates_When_UserRenamed", () => {
  const renamedAt = new Date(Date.now() - 10 * DAY_MS);
  const user = { renamedAt, previousUsername: "alex" };

  expect(nextRenameAt(user)).toEqual(new Date(renamedAt.getTime() + RENAME_COOLDOWN_MS));
  expect(revertUntil(user)).toEqual(nextRenameAt(user));
  expect(revertUntil({ ...user, previousUsername: null })).toBeNull();
  expect(nextRenameAt({ renamedAt: null })).toBeNull();
});
