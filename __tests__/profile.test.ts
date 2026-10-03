// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";
import { lobbies, races, results, users } from "../db/schema";
import { createLobby } from "../lib/lobbies";
import { createRace } from "../lib/races";
import {
  computeStats,
  findProfileUser,
  listRaceHistory,
  type HistoryEntry,
} from "../lib/profile";

// Une course terminée sans bonus ni faute ; chaque test change ce qui compte.
function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    raceId: Math.random().toString(36).slice(2),
    date: new Date(),
    textTitle: "Texte",
    content: "chat",
    rank: 1,
    wpm: 50,
    accuracy: 100,
    finished: true,
    bonusesEnabled: false,
    keyErrors: {},
    ...overrides,
  };
}

describe("computeStats", () => {
  test("Should_ReturnEmptyStats_When_UserHasNoRace", () => {
    expect(computeStats([])).toEqual({
      bestWpm: null,
      averageWpm: null,
      averageAccuracy: null,
      hardestKeys: [],
    });
  });

  test("Should_AverageSpeedAndAccuracy_When_RacesAreFinished", () => {
    const stats = computeStats([
      entry({ wpm: 40, accuracy: 90 }),
      entry({ wpm: 60, accuracy: 100 }),
    ]);

    expect(stats).toMatchObject({ bestWpm: 60, averageWpm: 50, averageAccuracy: 95 });
  });

  test("Should_IgnoreUnfinishedRaces_When_ComputingSpeedAndAccuracy", () => {
    const stats = computeStats([
      entry({ wpm: 40, accuracy: 90 }),
      entry({ wpm: 99, accuracy: 10, finished: false }),
    ]);

    expect(stats).toMatchObject({ bestWpm: 40, averageWpm: 40, averageAccuracy: 90 });
  });

  test("Should_ReturnNullSpeeds_When_NoRaceIsFinished", () => {
    const stats = computeStats([entry({ finished: false })]);

    expect(stats).toMatchObject({ bestWpm: null, averageWpm: null, averageAccuracy: null });
  });

  test("Should_IgnoreBonusRaceInBestSpeed_When_ItWasFaster", () => {
    const stats = computeStats([
      entry({ wpm: 40 }),
      entry({ wpm: 120, bonusesEnabled: true }),
    ]);

    expect(stats.bestWpm).toBe(40);
    expect(stats.averageWpm).toBe(80);
  });

  test("Should_ReturnNullBestSpeed_When_EveryFinishedRaceHadBonuses", () => {
    expect(computeStats([entry({ bonusesEnabled: true })]).bestWpm).toBeNull();
  });

  test("Should_AddErrorsAcrossRaces_When_FindingHardestKeys", () => {
    const stats = computeStats([
      entry({ keyErrors: { é: 2, a: 1 } }),
      entry({ keyErrors: { é: 3 }, finished: false }),
      entry({ keyErrors: { a: 1, " ": 4 } }),
    ]);

    expect(stats.hardestKeys).toEqual([
      { key: "é", errors: 5 },
      { key: " ", errors: 4 },
      { key: "a", errors: 2 },
    ]);
  });

  test("Should_KeepFiveKeys_When_MoreKeysHaveErrors", () => {
    const stats = computeStats([entry({ keyErrors: { a: 6, b: 5, c: 4, d: 3, e: 2, f: 1 } })]);

    expect(stats.hardestKeys.map((key) => key.key)).toEqual(["a", "b", "c", "d", "e"]);
  });

  test("Should_SkipKeys_When_TheyHaveZeroErrors", () => {
    expect(computeStats([entry({ keyErrors: { a: 0 } })]).hardestKeys).toEqual([]);
  });
});

describe("profile queries", () => {
  const createdIds: string[] = [];

  async function newUser(isGuest = false) {
    const [user] = await db
      .insert(users)
      .values({ username: `T_${Math.random().toString(36).slice(2, 12)}`, isGuest })
      .returning();
    createdIds.push(user.id);
    return user;
  }

  async function newResult(userId: string, endedAt: Date, rank = 1) {
    const race = (await createRace(await createLobby(userId, "unlisted")))!;
    await db.update(races).set({ endedAt }).where(eq(races.id, race.id));
    await db.insert(results).values({
      raceId: race.id,
      userId,
      rank,
      wpm: 42,
      accuracy: 97,
      durationMs: 60_000,
      errorCount: 1,
      finished: true,
      keyErrors: { e: 1 },
    });
    return race;
  }

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "db/migrations" });
  });

  afterEach(async () => {
    const ids = createdIds.splice(0);
    await db.delete(lobbies).where(inArray(lobbies.hostId, ids));
    await db.delete(users).where(inArray(users.id, ids));
  });

  afterAll(async () => {
    await db.$client.end();
  });

  test("Should_FindUser_When_UsernameCaseDiffers", async () => {
    const user = await newUser();

    expect((await findProfileUser(user.username.toLowerCase()))?.id).toBe(user.id);
  });

  test("Should_ReturnNull_When_UserIsAGuest", async () => {
    const guest = await newUser(true);

    expect(await findProfileUser(guest.username)).toBeNull();
  });

  test("Should_ReturnNull_When_UsernameIsUnknown", async () => {
    expect(await findProfileUser("personne_inconnue_xyz")).toBeNull();
  });

  test("Should_ListRacesNewestFirst_When_UserHasRaced", async () => {
    const user = await newUser();
    const older = await newResult(user.id, new Date("2026-01-01T10:00:00Z"), 2);
    const newer = await newResult(user.id, new Date("2026-02-01T10:00:00Z"));

    const history = await listRaceHistory(user.id);

    expect(history.map((race) => race.raceId)).toEqual([newer.id, older.id]);
    expect(history[1]).toMatchObject({
      date: new Date("2026-01-01T10:00:00Z"),
      textTitle: expect.any(String),
      content: older.content,
      rank: 2,
      wpm: 42,
      accuracy: 97,
      finished: true,
      bonusesEnabled: false,
      keyErrors: { e: 1 },
    });
  });

  test("Should_ListOnlyOwnRaces_When_OthersHaveRaced", async () => {
    const user = await newUser();
    await newResult((await newUser()).id, new Date());

    expect(await listRaceHistory(user.id)).toEqual([]);
  });
});
