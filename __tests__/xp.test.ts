import { describe, expect, test } from "vitest";
import { levelFromXp, levelProgress, raceXp, xpForLevel } from "../lib/xp";

describe("raceXp", () => {
  test("Should_Give100_When_First", () => {
    expect(raceXp(1, 4, true)).toBe(100);
  });

  test("Should_Give20_When_Last", () => {
    expect(raceXp(4, 4, true)).toBe(20);
  });

  test("Should_GiveInBetween_When_InTheMiddle", () => {
    expect(raceXp(2, 3, true)).toBe(60);
  });

  test("Should_GiveNothing_When_AloneInRace", () => {
    expect(raceXp(1, 1, true)).toBe(0);
  });

  test("Should_GiveNothing_When_NotFinished", () => {
    expect(raceXp(1, 4, false)).toBe(0);
  });
});

describe("levelFromXp", () => {
  test("Should_BeLevelOne_When_NoXp", () => {
    expect(levelFromXp(0)).toBe(1);
  });

  test("Should_StayOnLevel_When_OneXpShortOfNext", () => {
    expect(levelFromXp(99)).toBe(1);
  });

  test("Should_ReachLevelTwo_When_100Xp", () => {
    expect(levelFromXp(100)).toBe(2);
  });

  test("Should_Cost100TimesLevel_When_GoingUp", () => {
    // 100 + 200 = 300 pour le niveau 3, + 300 = 600 pour le niveau 4.
    expect(xpForLevel(3)).toBe(300);
    expect(xpForLevel(4)).toBe(600);
    expect(levelFromXp(599)).toBe(3);
    expect(levelFromXp(600)).toBe(4);
  });

  test("Should_HaveNoCap_When_XpIsHuge", () => {
    expect(levelFromXp(xpForLevel(200))).toBe(200);
  });
});

test("Should_GiveXpIntoCurrentLevel_When_ComputingProgress", () => {
  expect(levelProgress(450)).toEqual({ level: 3, current: 150, needed: 300 });
});
