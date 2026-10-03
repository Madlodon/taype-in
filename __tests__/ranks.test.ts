// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";
import { users } from "../db/schema";
import { MAX_RANK_LEVEL, rankFromLevel, rankMoves } from "../lib/ranks";
import { updateRanks } from "../lib/results";

describe("rankFromLevel", () => {
  test("Should_BeBronzeOneDivisionOne_When_LevelIsZero", () => {
    expect(rankFromLevel(0)).toEqual({ tier: "bronze", subRank: 1, division: 1 });
  });

  test("Should_GoToNextSubRank_When_FourDivisionsAreDone", () => {
    expect(rankFromLevel(3)).toEqual({ tier: "bronze", subRank: 1, division: 4 });
    expect(rankFromLevel(4)).toEqual({ tier: "bronze", subRank: 2, division: 1 });
  });

  test("Should_GoToNextTier_When_ThirdSubRankIsDone", () => {
    expect(rankFromLevel(12)).toEqual({ tier: "silver", subRank: 1, division: 1 });
  });

  test("Should_BeGrandChampionThreeDivisionFour_When_OneBelowTheTop", () => {
    expect(rankFromLevel(MAX_RANK_LEVEL - 1)).toEqual({
      tier: "grandChampion",
      subRank: 3,
      division: 4,
    });
  });

  test("Should_BeSupersonicLegend_When_LevelIsTheTop", () => {
    expect(MAX_RANK_LEVEL).toBe(84);
    expect(rankFromLevel(MAX_RANK_LEVEL)).toEqual({ tier: "supersonicLegend" });
  });
});

describe("rankMoves", () => {
  test("Should_MoveNobody_When_PlayerIsAlone", () => {
    expect(rankMoves(1)).toEqual([0]);
  });

  test("Should_MoveWinnerUpAndLoserDown_When_TwoPlayers", () => {
    expect(rankMoves(2)).toEqual([1, -1]);
  });

  test("Should_KeepSecondInPlace_When_ThreePlayers", () => {
    expect(rankMoves(3)).toEqual([1, 0, -1]);
  });

  test("Should_KeepTheTwoInTheMiddle_When_FourPlayers", () => {
    expect(rankMoves(4)).toEqual([1, 0, 0, -1]);
  });

  test("Should_MoveHalfMinusTheMiddle_When_SevenPlayers", () => {
    expect(rankMoves(7)).toEqual([1, 1, 1, 0, -1, -1, -1]);
  });

  test("Should_MoveTopFiveAndBottomFive_When_ElevenPlayers", () => {
    expect(rankMoves(11)).toEqual([1, 1, 1, 1, 1, 0, -1, -1, -1, -1, -1]);
  });

  test("Should_NeverMoveMoreThanFive_When_LobbyIsBig", () => {
    const moves = rankMoves(30);
    expect(moves.filter((move) => move === 1)).toHaveLength(5);
    expect(moves.filter((move) => move === -1)).toHaveLength(5);
  });
});

describe("updateRanks", () => {
  const createdIds: string[] = [];

  async function newUser(rankLevel = 10, isGuest = false) {
    const [user] = await db
      .insert(users)
      .values({ username: `t_${Math.random().toString(36).slice(2, 12)}`, isGuest, rankLevel })
      .returning();
    createdIds.push(user.id);
    return user;
  }

  async function levels(ids: string[]) {
    const rows = await db
      .select({ id: users.id, rankLevel: users.rankLevel })
      .from(users)
      .where(inArray(users.id, ids));
    return ids.map((id) => rows.find((row) => row.id === id)!.rankLevel);
  }

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "db/migrations" });
  });

  afterEach(async () => {
    await db.delete(users).where(inArray(users.id, createdIds.splice(0)));
  });

  afterAll(async () => {
    await db.$client.end();
  });

  test("Should_StartAtBronzeOneDivisionOne_When_UserIsNew", async () => {
    const [user] = await db
      .insert(users)
      .values({ username: `t_${Math.random().toString(36).slice(2, 12)}` })
      .returning();
    createdIds.push(user.id);

    expect(user.rankLevel).toBe(0);
  });

  test("Should_SaveNewLevelsInFinishingOrder_When_FourPlayers", async () => {
    const ids = (await Promise.all([newUser(), newUser(), newUser(), newUser()])).map((u) => u.id);

    const updates = await updateRanks(ids);

    expect(await levels(ids)).toEqual([11, 10, 10, 9]);
    expect(ids.map((id) => updates.get(id)!.rankChange)).toEqual([1, 0, 0, -1]);
  });

  test("Should_RankGuests_When_TheyRace", async () => {
    const guest = await newUser(0, true);
    const user = await newUser(5);

    await updateRanks([guest.id, user.id]);

    expect(await levels([guest.id, user.id])).toEqual([1, 4]);
  });

  test("Should_StayAtBronzeOne_When_LastAtTheFloor", async () => {
    const winner = await newUser(0);
    const loser = await newUser(0);

    const updates = await updateRanks([winner.id, loser.id]);

    expect(updates.get(loser.id)).toEqual({ rankLevel: 0, rankChange: 0 });
  });

  test("Should_StaySupersonicLegend_When_FirstAtTheTop", async () => {
    const winner = await newUser(MAX_RANK_LEVEL);
    const loser = await newUser(MAX_RANK_LEVEL);

    const updates = await updateRanks([winner.id, loser.id]);

    expect(updates.get(winner.id)).toEqual({ rankLevel: MAX_RANK_LEVEL, rankChange: 0 });
    expect(updates.get(loser.id)).toEqual({ rankLevel: MAX_RANK_LEVEL - 1, rankChange: -1 });
  });

  test("Should_ChangeNothing_When_PlayerIsAlone", async () => {
    const user = await newUser(7);

    const updates = await updateRanks([user.id]);

    expect(updates.get(user.id)).toEqual({ rankLevel: 7, rankChange: 0 });
  });
});
