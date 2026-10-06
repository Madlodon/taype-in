// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";
import { lobbies, races, results, users } from "../db/schema";
import { createLobby } from "../lib/lobbies";
import type { HistoryEntry } from "../lib/profile";
import { createRace } from "../lib/races";
import { currentSession, getSessionStats, SESSION_GAP_MS } from "../lib/session-stats";

const NOW = new Date("2026-10-04T20:00:00Z").getTime();
const MINUTE = 60 * 1000;

// Une course terminée il y a `minutesAgo` minutes.
function entry(minutesAgo: number): HistoryEntry {
  return {
    raceId: String(minutesAgo),
    date: new Date(NOW - minutesAgo * MINUTE),
    textTitle: null,
    content: "chat",
    rank: 1,
    wpm: 50,
    accuracy: 100,
    finished: true,
    bonusesEnabled: false,
    keyErrors: {},
  };
}

describe("currentSession", () => {
  test("Should_ReturnEmpty_When_UserHasNoRace", () => {
    expect(currentSession([], NOW)).toEqual([]);
  });

  test("Should_KeepRacesInARow_When_GapsAreUnder30Minutes", () => {
    const history = [entry(1), entry(10), entry(35)];

    expect(currentSession(history, NOW)).toEqual(history);
  });

  test("Should_StopAtLongBreak_When_OlderRacesAreFromAnotherSession", () => {
    const history = [entry(1), entry(10), entry(41), entry(45)];

    expect(currentSession(history, NOW).map((race) => race.raceId)).toEqual(["1", "10"]);
  });

  test("Should_KeepRace_When_GapIsExactly30Minutes", () => {
    const history = [entry(0), entry(SESSION_GAP_MS / MINUTE)];

    expect(currentSession(history, NOW)).toHaveLength(2);
  });

  test("Should_ReturnEmpty_When_LastRaceEndedOver30MinutesAgo", () => {
    expect(currentSession([entry(31), entry(35)], NOW)).toEqual([]);
  });
});

describe("getSessionStats", () => {
  const createdIds: string[] = [];

  async function newUser(isGuest: boolean) {
    const [user] = await db
      .insert(users)
      .values({ username: `T_${Math.random().toString(36).slice(2, 12)}`, isGuest })
      .returning();
    createdIds.push(user.id);
    return user;
  }

  async function newResult(userId: string, minutesAgo: number, wpm: number, finished = true) {
    const race = (await createRace(await createLobby(userId, "unlisted")))!;
    await db
      .update(races)
      .set({ endedAt: new Date(NOW - minutesAgo * MINUTE) })
      .where(eq(races.id, race.id));
    await db.insert(results).values({
      raceId: race.id,
      userId,
      rank: 1,
      wpm,
      accuracy: 90,
      durationMs: 60_000,
      errorCount: 1,
      finished,
    });
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

  test("Should_SummarizeCurrentSession_When_GuestRacedInARow", async () => {
    const guest = await newUser(true);
    await newResult(guest.id, 2, 60);
    await newResult(guest.id, 10, 40);
    await newResult(guest.id, 15, 99, false);
    // Session d'avant : une longue pause la sépare.
    await newResult(guest.id, 120, 150);

    expect(await getSessionStats(guest.id, NOW)).toEqual({
      races: 3,
      bestWpm: 60,
      averageWpm: 50,
      averageAccuracy: 90,
    });
  });

  test("Should_ReturnZeroRaces_When_UserHasNotRaced", async () => {
    const user = await newUser(false);

    expect(await getSessionStats(user.id, NOW)).toEqual({
      races: 0,
      bestWpm: null,
      averageWpm: null,
      averageAccuracy: null,
    });
  });
});
