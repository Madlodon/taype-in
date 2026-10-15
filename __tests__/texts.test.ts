// @vitest-environment node
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";
import { texts } from "../db/schema";
import {
  cutText,
  normalizeLetters,
  pickText,
  pickWords,
  scrambleWords,
  TEXT_LENGTHS,
  toDictionary,
} from "../lib/texts";

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "db/migrations" });
});

afterAll(async () => {
  await db.$client.end();
});

describe("cutText", () => {
  const story = "One two three. Four five six! Seven eight nine? Ten eleven.";

  test("Should_EndAtSentenceReachingTarget_When_TargetFallsInsideSentence", () => {
    expect(cutText(story, 4)).toBe("One two three. Four five six!");
  });

  test("Should_StopAtSentence_When_TargetIsReachedExactly", () => {
    expect(cutText(story, 3)).toBe("One two three.");
  });

  test("Should_KeepFirstSentence_When_TargetIsOneWord", () => {
    expect(cutText(story, 1)).toBe("One two three.");
  });

  test("Should_ReturnWholeText_When_TargetIsLongerThanText", () => {
    expect(cutText(story, 500)).toBe(story);
  });

  test("Should_NotCutInsideWord_When_PeriodIsFollowedByLetter", () => {
    expect(cutText("Version 1.5 is out now. Try it.", 2)).toBe("Version 1.5 is out now.");
  });

  test("Should_KeepEllipsis_When_SentenceEndsWithSeveralDots", () => {
    expect(cutText("Wait for it... Done.", 2)).toBe("Wait for it...");
  });

  test("Should_ReturnEmptyString_When_TextIsEmpty", () => {
    expect(cutText("", 50)).toBe("");
  });
});

describe("toDictionary", () => {
  test("Should_KeepLowercaseWordsWithoutPunctuation_When_TextHasSentences", () => {
    expect(toDictionary(["L'été, c'est « super » ! 42 fois.", "Été encore"])).toEqual([
      "l'été",
      "c'est",
      "super",
      "fois",
      "été",
      "encore",
    ]);
  });
});

describe("normalizeLetters", () => {
  test("Should_KeepLettersOnceInLowercase_When_InputIsMixed", () => {
    expect(normalizeLetters(" Q-z q1 É")).toBe("qzé");
  });

  test("Should_ReturnEmpty_When_InputHasNoLetter", () => {
    expect(normalizeLetters("12 !?")).toBe("");
  });
});

describe("scrambleWords", () => {
  const dictionary = ["chat", "école", "garçon", "l'ami", "zèbre", "pomme", "table"];
  const words = (text: string) => text.split(" ");

  test("Should_ReturnRequestedWordCountFromDictionary_When_NoTarget", () => {
    const text = scrambleWords(dictionary, 200, [], "");

    expect(words(text)).toHaveLength(200);
    expect(words(text).every((word) => dictionary.includes(word))).toBe(true);
  });

  test.each([
    ["accents", /[éè]/],
    ["cedilla", /ç/],
    ["apostrophe", /'/],
  ] as const)("Should_FavourTargetedWords_When_TargetIs_%s", (target, pattern) => {
    const text = scrambleWords(dictionary, 200, [target], "");

    // Sans ciblage, environ 1 mot sur 7 ; avec ciblage, plus de la moitié.
    expect(words(text).filter((word) => pattern.test(word)).length).toBeGreaterThan(70);
  });

  test("Should_FavourWordsWithLetters_When_HostPicksLetters", () => {
    const text = scrambleWords(dictionary, 200, [], "z");

    expect(words(text).filter((word) => word.includes("z")).length).toBeGreaterThan(70);
  });

  test("Should_AddCommasNotAtEnd_When_CommaIsTargeted", () => {
    const text = scrambleWords(dictionary, 200, ["comma"], "");

    expect(text).toMatch(/\p{L},/u);
    expect(text.endsWith(",")).toBe(false);
  });

  test("Should_InsertNumbers_When_DigitsAreTargeted", () => {
    expect(words(scrambleWords(dictionary, 200, ["digits"], "")).some((word) => /^\d+$/.test(word)))
      .toBe(true);
  });

  test("Should_InsertSpecialCharacters_When_SpecialIsTargeted", () => {
    expect(scrambleWords(dictionary, 200, ["special"], "")).toMatch(/[@#$%&*+=/?!]/);
  });

  test("Should_IgnoreTarget_When_NoWordMatches", () => {
    const text = scrambleWords(["cat", "dog"], 20, ["accents"], "");

    expect(words(text).every((word) => ["cat", "dog"].includes(word))).toBe(true);
  });

  test("Should_ReturnEmptyString_When_DictionaryIsEmpty", () => {
    expect(scrambleWords([], 50, ["digits"], "")).toBe("");
  });
});

describe("pickWords", () => {
  test("Should_UseWordsFromBankInLanguage_When_LobbyUsesScrambledWords", async () => {
    const bank = await db.select().from(texts).where(eq(texts.language, "fr"));
    const dictionary = toDictionary(bank.map((text) => text.content));

    const picked = await pickWords("fr", 50, [], "");

    expect(picked!.split(" ")).toHaveLength(50);
    expect(picked!.split(" ").every((word) => dictionary.includes(word))).toBe(true);
  });
});

describe("pickText", () => {
  test.each(["fr", "en"] as const)(
    "Should_ReturnBankTextInLanguage_When_LanguageIs_%s",
    async (language) => {
      const picked = await pickText(language, 50);

      const [source] = await db.select().from(texts).where(eq(texts.id, picked!.textId));
      expect(source.language).toBe(language);
      expect(source.content.startsWith(picked!.content)).toBe(true);
    },
  );

  test.each(TEXT_LENGTHS)(
    "Should_CutAtEndOfSentenceAfterTarget_When_LengthIs_%i",
    async (length) => {
      const picked = await pickText("en", length);

      expect(wordCount(picked!.content)).toBeGreaterThanOrEqual(length);
      expect(picked!.content).toMatch(/[.!?]$/);
    },
  );
});

test.each(["fr", "en"] as const)(
  "Should_HaveSeveralTextsLongerThanMaxLength_When_BankIsSeeded_%s",
  async (language) => {
    const bank = await db.select().from(texts).where(eq(texts.language, language));

    expect(bank.length).toBeGreaterThanOrEqual(5);
    for (const text of bank) {
      expect(wordCount(text.content)).toBeGreaterThan(Math.max(...TEXT_LENGTHS));
    }
  },
);
