// @vitest-environment node
import { afterAll, beforeAll, expect, test } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";
import { results, texts, users } from "../db/schema";
import { logIn } from "../lib/auth";
import { listRaceHistory } from "../lib/profile";
import { levelFromXp } from "../lib/xp";
import { lockLoadout } from "../lib/garage-items";
import { DEMO_PASSWORD, DEMO_USERNAME, deleteSeedData, seed, SEED_USERNAMES } from "../scripts/seed";

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "db/migrations" });
  await seed();
});

afterAll(async () => {
  await deleteSeedData();
  await db.$client.end();
});

async function seededUsers() {
  return db.select().from(users).where(inArray(users.username, SEED_USERNAMES));
}

test("Should_LogIn_When_UsingDemoCredentials", async () => {
  const user = await logIn(DEMO_USERNAME, DEMO_PASSWORD);

  expect(user?.username).toBe(DEMO_USERNAME);
});

test("Should_KeepTextCorpus_When_Seeded", async () => {
  const languages = await db.selectDistinct({ language: texts.language }).from(texts);

  expect(languages.map((row) => row.language).sort()).toEqual(["en", "fr"]);
});

test("Should_GiveDemoARaceHistory_When_Seeded", async () => {
  const [demo] = await db.select().from(users).where(eq(users.username, DEMO_USERNAME));

  const history = await listRaceHistory(demo.id);

  expect(history).toHaveLength(24);
  expect(history.every((entry) => entry.date < new Date())).toBe(true);
});

test("Should_RankEachRaceFromOne_When_Seeded", async () => {
  const rows = await db
    .select({ raceId: results.raceId, rank: results.rank })
    .from(results)
    .innerJoin(users, eq(users.id, results.userId))
    .where(inArray(users.username, SEED_USERNAMES));
  const ranks = new Map<string, number[]>();
  for (const row of rows) ranks.set(row.raceId, [...(ranks.get(row.raceId) ?? []), row.rank]);

  for (const raceRanks of ranks.values()) {
    expect(raceRanks.sort((a, b) => a - b)).toEqual(raceRanks.map((_, i) => i + 1));
    expect(raceRanks.length).toBeGreaterThanOrEqual(3);
  }
});

test("Should_GiveXpAndUnlockedLoadout_When_Seeded", async () => {
  for (const user of await seededUsers()) {
    expect(user.xp).toBeGreaterThan(0);
    const loadout = { car: user.car, boost: user.boost, hat: user.hat, ball: user.ball, stadium: user.stadium };
    expect(lockLoadout(loadout as never, levelFromXp(user.xp))).toEqual(loadout);
  }
});

test("Should_RecreateSameData_When_SeededTwice", async () => {
  const before = await seededUsers();

  await seed();
  const after = await seededUsers();

  expect(after).toHaveLength(SEED_USERNAMES.length);
  expect(after.map(({ username, xp, rankLevel }) => ({ username, xp, rankLevel })).sort((a, b) => a.username.localeCompare(b.username))).toEqual(
    before.map(({ username, xp, rankLevel }) => ({ username, xp, rankLevel })).sort((a, b) => a.username.localeCompare(b.username)),
  );
});

test("Should_KeepOtherUsers_When_Reseeded", async () => {
  const [other] = await db.insert(users).values({ username: `keep_${Date.now()}` }).returning();

  await seed();

  expect(await db.select().from(users).where(eq(users.id, other.id))).toHaveLength(1);
  await db.delete(users).where(eq(users.id, other.id));
});
