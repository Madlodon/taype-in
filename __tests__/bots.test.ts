import { describe, expect, test } from "vitest";
import {
  BOT_LEVELS,
  BOT_PROFILES,
  botKey,
  botSeed,
  createBotEngine,
  isHardWord,
  seededRandom,
  xpMultiplier,
  type BotEngine,
  type BotLevel,
} from "../lib/bots";
import { countCorrect, EMPTY_TYPING, wordsPerMinute, type ErrorMode } from "../lib/typing";

// Texte simple : mots courts, sans accent, majuscule ni ponctuation.
const TEXT = "le chat dort sur le lit pendant que la pluie tombe dans le jardin ".repeat(80);
const HARD_TEXT = "Extraordinairement, l'électricité arrêtée « inattendue » déroutait. ".repeat(40);

// Fait taper tout le texte au bot et renvoie sa saisie, le temps pris et chaque délai.
function race(level: BotLevel, mode: ErrorMode = "blocking", seed = 1, text = TEXT) {
  const engine = createBotEngine(level, seed);
  let typing = EMPTY_TYPING;
  let durationMs = 0;
  const delays: number[] = [];
  while (typing.typed.length < text.length) {
    const key = botKey(engine, typing, text, mode);
    typing = key.typing;
    durationMs += key.delayMs;
    delays.push(key.delayMs);
  }
  return { engine, typing, durationMs, delays };
}

function wpmOf({ typing, durationMs }: ReturnType<typeof race>, text = TEXT) {
  return wordsPerMinute(countCorrect(typing.typed, text), durationMs);
}

// Moteur au rythme normal, dans une série en cours, qui tire les valeurs données dans l'ordre.
function fixedEngine(values: number[]): BotEngine {
  return { ...createBotEngine("intermediate", 1), pace: 1, paceKeys: 10, random: () => values.shift()! };
}

describe("seededRandom", () => {
  test("Should_GiveSameSequence_When_SeedIsTheSame", () => {
    const first = seededRandom(42);
    const second = seededRandom(42);

    expect(Array.from({ length: 5 }, first)).toEqual(Array.from({ length: 5 }, second));
  });

  test("Should_GiveDifferentSequence_When_SeedDiffers", () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });

  test("Should_StayBetweenZeroAndOne_When_DrawingManyValues", () => {
    const values = Array.from({ length: 1000 }, seededRandom(7));

    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
  });
});

describe("botSeed", () => {
  test("Should_BeStable_When_SameRaceAndBot", () => {
    const bot = { level: "expert", number: 1 } as const;

    expect(botSeed("race-1", bot)).toBe(botSeed("race-1", bot));
  });

  test("Should_Differ_When_RaceOrBotNumberDiffers", () => {
    const seed = botSeed("race-1", { level: "expert", number: 1 });

    expect(botSeed("race-2", { level: "expert", number: 1 })).not.toBe(seed);
    expect(botSeed("race-1", { level: "expert", number: 2 })).not.toBe(seed);
  });
});

describe("createBotEngine", () => {
  test.each(BOT_LEVELS)("Should_PickSpeedInLevelRange_When_LevelIs_%s", (level) => {
    for (let seed = 0; seed < 50; seed++) {
      const { wpm } = createBotEngine(level, seed);

      expect(wpm).toBeGreaterThanOrEqual(BOT_PROFILES[level].minWpm);
      expect(wpm).toBeLessThanOrEqual(BOT_PROFILES[level].maxWpm);
    }
  });
});

describe("botKey", () => {
  test("Should_ReplayExactlyTheSameRace_When_SeedIsTheSame", () => {
    const first = race("intermediate", "tolerant", 9);
    const second = race("intermediate", "tolerant", 9);

    expect(second.typing).toEqual(first.typing);
    expect(second.delays).toEqual(first.delays);
  });

  test.each(BOT_LEVELS)("Should_TypeAtItsOwnSpeed_When_LevelIs_%s", (level) => {
    const result = race(level);

    expect(wpmOf(result)).toBeGreaterThan(result.engine.wpm * 0.9);
    expect(wpmOf(result)).toBeLessThan(result.engine.wpm * 1.1);
  });

  test("Should_BeFasterAtEachLevel_When_LevelsRaceTheSameText", () => {
    const durations = BOT_LEVELS.map((level) => race(level).durationMs);

    expect(durations).toEqual([...durations].sort((a, b) => b - a));
  });

  test.each(BOT_LEVELS)("Should_MakeMistakesAtLevelRate_When_LevelIs_%s", (level) => {
    const { typing } = race(level, "tolerant");

    expect(typing.errors / typing.keys).toBeCloseTo(BOT_PROFILES[level].errorRate, 1);
  });

  test("Should_RetypeRightCharacter_When_BotMakesMistakeInBlockingMode", () => {
    const { typing } = race("noob", "blocking");

    expect(typing.typed).toBe(TEXT);
    expect(typing.errors).toBeGreaterThan(0);
  });

  test("Should_LeaveMistakesInText_When_BotMakesMistakeInTolerantMode", () => {
    const { typing } = race("noob", "tolerant");

    expect(typing.typed).toHaveLength(TEXT.length);
    expect(countCorrect(typing.typed, TEXT)).toBe(TEXT.length - typing.errors);
  });

  test("Should_TakeThreeTimesLonger_When_BotMustNoticeAMistake", () => {
    // Valeurs tirées : variation du délai (0,5 = aucune), puis faute (0) ou non (0,99).
    const right = botKey(fixedEngine([0.5, 0.99]), EMPTY_TYPING, TEXT, "blocking");
    const wrong = botKey(fixedEngine([0.5, 0]), EMPTY_TYPING, TEXT, "blocking");

    expect(wrong.typing.errors).toBe(1);
    expect(wrong.delayMs).toBeCloseTo(right.delayMs * 3);
  });

  test("Should_AlternateBurstsAndHesitations_When_BotTypesALongText", () => {
    const { delays, engine } = race("expert");
    const average = 12_000 / engine.wpm;

    expect(delays.some((delay) => delay < average * 0.5)).toBe(true);
    expect(delays.some((delay) => delay > average * 2)).toBe(true);
  });

  test("Should_TypeSlower_When_TextHasHardWords", () => {
    const easy = wpmOf(race("expert", "blocking", 4));
    const hard = wpmOf(race("expert", "blocking", 4, HARD_TEXT), HARD_TEXT);

    expect(hard).toBeLessThan(easy * 0.8);
  });

  test("Should_SkipRemovedWord_When_BotReachesIt", () => {
    const content = "le chat dort";
    const typing = { ...EMPTY_TYPING, typed: "le cha" };

    const { typing: next } = botKey(fixedEngine([0.5, 0.99]), typing, content, "blocking", [
      { start: 7, end: 12 },
    ]);

    expect(next.typed).toBe(content);
    expect(next.keys).toBe(1);
  });

  test("Should_FinishRace_When_WordsAreRemovedAhead", () => {
    const engine = createBotEngine("expert", 2);
    const removed = [
      { start: 2, end: 7 },
      { start: 20, end: 24 },
    ];
    let typing = EMPTY_TYPING;
    while (typing.typed.length < TEXT.length) {
      typing = botKey(engine, typing, TEXT, "blocking", removed).typing;
    }

    expect(typing.typed).toBe(TEXT);
    expect(typing.keys - typing.errors).toBe(TEXT.length - 9);
  });
});

describe("isHardWord", () => {
  test.each([
    ["long", "extraordinaire", 3],
    ["accent", "été", 0],
    ["capital", "Paris", 2],
    ["punctuation", "fin.", 1],
  ])("Should_BeHard_When_WordHas_%s", (_, text, index) => {
    expect(isHardWord(text, index)).toBe(true);
  });

  test("Should_BeEasy_When_WordIsShortAndPlain", () => {
    expect(isHardWord("le chat dort", 4)).toBe(false);
  });

  test("Should_BeEasy_When_CharacterIsASpace", () => {
    expect(isHardWord("Paris est", 5)).toBe(false);
  });
});

describe("xpMultiplier", () => {
  test.each([
    ["noob", 0.25],
    ["beginner", 0.5],
    ["intermediate", 1],
    ["expert", 1.5],
    ["impossible", 2],
  ] as const)("Should_UseLevelMultiplier_When_OnlyBotIs_%s", (level, expected) => {
    expect(xpMultiplier([level], 0)).toBe(expected);
  });

  test("Should_AverageBotsAndCountHumansAsOne_When_RaceIsMixed", () => {
    // (2 + 0.5 + 1) ÷ 3
    expect(xpMultiplier(["impossible", "beginner"], 1)).toBeCloseTo(3.5 / 3);
  });

  test("Should_BeOne_When_ThereIsNoBot", () => {
    expect(xpMultiplier([], 4)).toBe(1);
  });
});
