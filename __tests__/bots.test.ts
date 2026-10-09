import { describe, expect, test } from "vitest";
import { BOT_LEVELS, BOT_PROFILES, botKey, xpMultiplier, type BotLevel } from "../lib/bots";
import { countCorrect, EMPTY_TYPING, wordsPerMinute, type ErrorMode } from "../lib/typing";

const TEXT = "le chat dort sur le canapé pendant que la pluie tombe. ".repeat(60);

// Hasard reproductible, pour que les tests donnent toujours le même résultat.
function seeded(seed: number) {
  return () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
    return seed / 2 ** 31;
  };
}

// Fait taper tout le texte au bot et renvoie sa saisie et le temps qu'il a pris.
function race(level: BotLevel, mode: ErrorMode = "blocking", seed = 1) {
  const random = seeded(seed);
  let typing = EMPTY_TYPING;
  let durationMs = 0;
  while (typing.typed.length < TEXT.length) {
    const key = botKey(level, typing, TEXT, mode, random);
    typing = key.typing;
    durationMs += key.delayMs;
  }
  return { typing, durationMs };
}

describe("botKey", () => {
  test.each(BOT_LEVELS)("Should_TypeAtLevelSpeed_When_LevelIs_%s", (level) => {
    const { typing, durationMs } = race(level);

    const wpm = wordsPerMinute(countCorrect(typing.typed, TEXT), durationMs);

    expect(wpm).toBeGreaterThan(BOT_PROFILES[level].wpm * 0.9);
    expect(wpm).toBeLessThan(BOT_PROFILES[level].wpm * 1.1);
  });

  test("Should_BeFasterAtEachLevel_When_LevelsRaceTheSameText", () => {
    const durations = BOT_LEVELS.map((level) => race(level).durationMs);

    expect(durations).toEqual([...durations].sort((a, b) => b - a));
  });

  test.each(BOT_LEVELS)("Should_MakeMistakesAtLevelRate_When_LevelIs_%s", (level) => {
    const { typing } = race(level);

    expect(typing.errors / typing.keys).toBeCloseTo(BOT_PROFILES[level].errorRate, 1);
  });

  test("Should_RetypeRightCharacter_When_BotMakesMistakeInBlockingMode", () => {
    const { typing } = race("beginner", "blocking");

    expect(typing.typed).toBe(TEXT);
    expect(typing.errors).toBeGreaterThan(0);
  });

  test("Should_LeaveMistakesInText_When_BotMakesMistakeInTolerantMode", () => {
    const { typing } = race("beginner", "tolerant");

    expect(typing.typed).toHaveLength(TEXT.length);
    expect(countCorrect(typing.typed, TEXT)).toBe(TEXT.length - typing.errors);
  });

  test("Should_SlowDownSometimes_When_BotTypesALongText", () => {
    const random = seeded(3);
    const perChar = 12_000 / BOT_PROFILES.expert.wpm;
    const delays = Array.from(
      { length: 500 },
      () => botKey("expert", EMPTY_TYPING, TEXT, "blocking", random).delayMs,
    );

    expect(delays.some((delay) => delay > perChar * 2)).toBe(true);
  });
});

describe("xpMultiplier", () => {
  test.each([
    ["beginner", 0.5],
    ["intermediate", 1],
    ["advanced", 1.5],
    ["expert", 2],
  ] as const)("Should_UseLevelMultiplier_When_OnlyBotIs_%s", (level, expected) => {
    expect(xpMultiplier([level], 0)).toBe(expected);
  });

  test("Should_AverageBotsAndCountHumansAsOne_When_RaceIsMixed", () => {
    // (2 + 0.5 + 1) ÷ 3
    expect(xpMultiplier(["expert", "beginner"], 1)).toBeCloseTo(3.5 / 3);
  });

  test("Should_BeOne_When_ThereIsNoBot", () => {
    expect(xpMultiplier([], 4)).toBe(1);
  });
});
