// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";
import { lobbies, results, users } from "../db/schema";
import { createLobby } from "../lib/lobbies";
import { createRace } from "../lib/races";
import { xpForLevel } from "../lib/xp";
import { awardXp, rankRacers, saveResults, type Racer } from "../lib/results";
import { accuracy, countCorrect, wordsPerMinute } from "../lib/typing";

const TEXT = "chat";

// Un coureur qui a tout tapé sans faute en 1 min ; chaque test change ce qui compte.
function racer(overrides: Partial<Racer> = {}): Racer {
  return {
    id: Math.random().toString(36).slice(2),
    username: "joueur",
    typed: TEXT,
    errors: 0,
    keys: TEXT.length,
    keyErrors: {},
    finished: true,
    durationMs: 60_000,
    reachedAt: 0,
    ...overrides,
  };
}

function order(ranked: { username: string }[]) {
  return ranked.map((result) => result.username);
}

describe("countCorrect", () => {
  test("Should_CountEveryCharacter_When_AllAreRight", () => {
    expect(countCorrect("chat", TEXT)).toBe(4);
  });

  test("Should_SkipWrongCharacters_When_MistakesWereLeft", () => {
    expect(countCorrect("cxat", TEXT)).toBe(3);
  });

  test("Should_ReturnZero_When_NothingIsTyped", () => {
    expect(countCorrect("", TEXT)).toBe(0);
  });
});

describe("wordsPerMinute", () => {
  test("Should_DivideFiveCharacterWordsByMinutes_When_TimeHasPassed", () => {
    expect(wordsPerMinute(250, 60_000)).toBe(50);
  });

  test("Should_ScaleToOneMinute_When_RaceIsShorter", () => {
    expect(wordsPerMinute(100, 30_000)).toBe(40);
  });

  test.each([0, -1])("Should_ReturnZero_When_DurationIs_%i", (durationMs) => {
    expect(wordsPerMinute(100, durationMs)).toBe(0);
  });
});

describe("accuracy", () => {
  test("Should_Return100_When_NoKeyWasWrong", () => {
    expect(accuracy(40, 0)).toBe(100);
  });

  test("Should_ReturnShareOfRightKeys_When_SomeWereWrong", () => {
    expect(accuracy(40, 10)).toBe(75);
  });

  test("Should_ReturnZero_When_NoKeyWasPressed", () => {
    expect(accuracy(0, 0)).toBe(0);
  });

  test("Should_NotGoBelowZero_When_ErrorsExceedKeys", () => {
    expect(accuracy(2, 5)).toBe(0);
  });
});

describe("rankRacers", () => {
  test("Should_RankByTime_When_EveryoneFinished", () => {
    const ranked = rankRacers(
      [racer({ username: "lent", durationMs: 50_000 }), racer({ username: "rapide", durationMs: 40_000 })],
      TEXT,
      "blocking",
    );

    expect(order(ranked)).toEqual(["rapide", "lent"]);
    expect(ranked.map((result) => result.rank)).toEqual([1, 2]);
  });

  test("Should_AddOneSecondPerError_When_ModeIsTolerant", () => {
    const ranked = rankRacers(
      [
        racer({ username: "rapide", durationMs: 40_000, errors: 3 }),
        racer({ username: "précis", durationMs: 42_000 }),
      ],
      TEXT,
      "tolerant",
    );

    expect(order(ranked)).toEqual(["précis", "rapide"]);
    expect(ranked[1].penaltyMs).toBe(3000);
  });

  test("Should_IgnoreErrorsInRanking_When_ModeIsBlocking", () => {
    const ranked = rankRacers(
      [
        racer({ username: "précis", durationMs: 42_000 }),
        racer({ username: "rapide", durationMs: 40_000, errors: 3 }),
      ],
      TEXT,
      "blocking",
    );

    expect(order(ranked)).toEqual(["rapide", "précis"]);
    expect(ranked[0].penaltyMs).toBe(0);
  });

  test("Should_PutFinishersFirst_When_AnUnfinishedRacerWasFaster", () => {
    const ranked = rankRacers(
      [
        racer({ username: "pas fini", typed: "cha", finished: false, durationMs: 10_000 }),
        racer({ username: "fini", durationMs: 90_000 }),
      ],
      TEXT,
      "blocking",
    );

    expect(order(ranked)).toEqual(["fini", "pas fini"]);
  });

  test("Should_RankUnfinishedByProgress_When_SomeDidNotFinish", () => {
    const ranked = rankRacers(
      [
        racer({ username: "c", typed: "c", finished: false }),
        racer({ username: "cha", typed: "cha", finished: false }),
      ],
      TEXT,
      "blocking",
    );

    expect(order(ranked)).toEqual(["cha", "c"]);
  });

  test("Should_RankFirstToReachIt_When_ProgressIsTied", () => {
    const ranked = rankRacers(
      [
        racer({ username: "second", typed: "ch", finished: false, reachedAt: 200 }),
        racer({ username: "premier", typed: "ch", finished: false, reachedAt: 100 }),
      ],
      TEXT,
      "blocking",
    );

    expect(order(ranked)).toEqual(["premier", "second"]);
  });

  test("Should_GiveEachRacerTheirStats_When_RaceEnds", () => {
    const [result] = rankRacers(
      [racer({ typed: "chxt", errors: 1, keys: 5, keyErrors: { a: 1 }, durationMs: 6000 })],
      TEXT,
      "tolerant",
    );

    expect(result).toMatchObject({
      rank: 1,
      wpm: 6,
      accuracy: 80,
      durationMs: 6000,
      penaltyMs: 1000,
      errors: 1,
      finished: true,
      keyErrors: { a: 1 },
    });
  });

  test("Should_ReturnEmptyRanking_When_ThereAreNoRacers", () => {
    expect(rankRacers([], TEXT, "blocking")).toEqual([]);
  });
});

describe("saveResults", () => {
  const createdIds: string[] = [];

  async function newUser(isGuest = false) {
    const [user] = await db
      .insert(users)
      .values({ username: `t_${Math.random().toString(36).slice(2, 12)}`, isGuest })
      .returning();
    createdIds.push(user.id);
    return user;
  }

  async function newRace(hostId: string) {
    return (await createRace(await createLobby(hostId, "unlisted")))!;
  }

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "db/migrations" });
  });

  afterEach(async () => {
    const ids = createdIds.splice(0);
    await db.delete(lobbies).where(inArray(lobbies.hostId, ids));
    await db.delete(users).where(inArray(users.id, ids));
  });

  test("Should_SaveEveryStat_When_RacerIsRegistered", async () => {
    const user = await newUser();
    const race = await newRace(user.id);
    const ranked = rankRacers(
      [racer({ id: user.id, errors: 2, keys: 6, keyErrors: { h: 2 } })],
      TEXT,
      "blocking",
    );

    await saveResults(race.id, ranked);

    const saved = await db.select().from(results).where(eq(results.raceId, race.id));
    expect(saved).toEqual([
      {
        raceId: race.id,
        userId: user.id,
        rank: 1,
        wpm: 0.8,
        // real : la base garde environ 7 chiffres.
        accuracy: expect.closeTo(66.667, 2),
        durationMs: 60_000,
        errorCount: 2,
        finished: true,
        keyErrors: { h: 2 },
      },
    ]);
  });

  test("Should_SaveGuestToo_When_GuestRaced", async () => {
    const guest = await newUser(true);
    const user = await newUser();
    const race = await newRace(user.id);
    const ranked = rankRacers(
      [
        racer({ id: guest.id, durationMs: 30_000 }),
        racer({ id: user.id, typed: "ch", finished: false }),
      ],
      TEXT,
      "blocking",
    );

    await saveResults(race.id, ranked);

    const saved = await db.select().from(results).where(eq(results.raceId, race.id));
    expect(saved.map((row) => [row.userId, row.rank, row.finished])).toEqual([
      [guest.id, 1, true],
      [user.id, 2, false],
    ]);
  });

  test("Should_SaveNothing_When_NobodyRaced", async () => {
    const race = await newRace((await newUser()).id);

    await saveResults(race.id, []);

    expect(await db.select().from(results).where(eq(results.raceId, race.id))).toEqual([]);
  });
});

test("Should_ExcludeRemovedWordsFromSpeed_When_GoalSkipsLetters", () => {
  const content = "one two three";
  const [result] = rankRacers([racer({ typed: content, keys: 7, removed: [{ start: 7, end: 13 }] })], content, "blocking");
  expect(result.wpm).toBe(7 / 5);
  expect(result.accuracy).toBe(100);
});

describe("awardXp", () => {
  const createdIds: string[] = [];

  async function newUser({ isGuest = false, xp = 0 } = {}) {
    const [user] = await db
      .insert(users)
      .values({ username: `t_${Math.random().toString(36).slice(2, 12)}`, isGuest, xp })
      .returning();
    createdIds.push(user.id);
    return user;
  }

  async function savedXp(ids: string[]) {
    const rows = await db.select({ id: users.id, xp: users.xp }).from(users).where(inArray(users.id, ids));
    return ids.map((id) => rows.find((row) => row.id === id)!.xp);
  }

  afterEach(async () => {
    await db.delete(users).where(inArray(users.id, createdIds.splice(0)));
  });

  test("Should_AddXpByPlace_When_EveryoneFinished", async () => {
    const first = await newUser({ xp: 50 });
    const second = await newUser();
    const third = await newUser();
    const ranked = rankRacers(
      [
        racer({ id: first.id, durationMs: 10_000 }),
        racer({ id: second.id, durationMs: 20_000 }),
        racer({ id: third.id, durationMs: 30_000 }),
      ],
      TEXT,
      "blocking",
    );

    const updates = await awardXp(ranked);

    expect(await savedXp([first.id, second.id, third.id])).toEqual([150, 60, 20]);
    expect(updates.get(first.id)).toEqual({ xp: 150, xpGained: 100 });
  });

  test("Should_GiveNothing_When_RacerDidNotFinish", async () => {
    const winner = await newUser();
    const quitter = await newUser({ xp: xpForLevel(3) });
    const ranked = rankRacers(
      [racer({ id: winner.id }), racer({ id: quitter.id, typed: "c", finished: false })],
      TEXT,
      "blocking",
    );

    const updates = await awardXp(ranked);

    expect(updates.get(quitter.id)).toEqual({ xp: xpForLevel(3), xpGained: 0 });
    expect(await savedXp([winner.id, quitter.id])).toEqual([100, xpForLevel(3)]);
  });

  test("Should_CountGuestsButGiveThemNothing_When_GuestRaced", async () => {
    const guest = await newUser({ isGuest: true });
    const user = await newUser();
    const ranked = rankRacers(
      [racer({ id: guest.id, durationMs: 10_000 }), racer({ id: user.id, durationMs: 20_000 })],
      TEXT,
      "blocking",
    );

    const updates = await awardXp(ranked);

    expect(updates.get(guest.id)).toEqual({ xp: null, xpGained: 0 });
    expect(updates.get(user.id)).toEqual({ xp: 20, xpGained: 20 });
    expect(await savedXp([guest.id])).toEqual([0]);
  });

  test("Should_MultiplyXp_When_RaceHasBots", async () => {
    const user = await newUser();
    const ranked = rankRacers(
      [racer({ id: user.id, durationMs: 10_000 }), racer({ id: crypto.randomUUID(), durationMs: 20_000 })],
      TEXT,
      "blocking",
    );

    const updates = await awardXp(ranked, 1.5);

    expect(updates.get(user.id)).toEqual({ xp: 150, xpGained: 150 });
  });

  test("Should_GiveNothing_When_AloneInRace", async () => {
    const user = await newUser();

    const updates = await awardXp(rankRacers([racer({ id: user.id })], TEXT, "blocking"));

    expect(updates.get(user.id)).toEqual({ xp: 0, xpGained: 0 });
  });
});

afterAll(async () => {
  await db.$client.end();
});
