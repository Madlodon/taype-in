// @vitest-environment node
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";
import { texts } from "../db/schema";
import {
  ALL_TEXT_OPTIONS,
  applyTextOptions,
  COMPLEXITIES,
  cutText,
  measureText,
  normalizeLetters,
  pickText,
  pickWords,
  scrambleWords,
  TEXT_LENGTHS,
  textComplexity,
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

describe("measureText", () => {
  test("Should_AverageLettersPerWord_When_TextHasWords", () => {
    expect(measureText("Le chat dort.").wordLength).toBeCloseTo(10 / 3);
  });

  test("Should_CountSpecialCharactersPer100Words_When_TextHasDigitsAndSymbols", () => {
    // « 8 » et « ! » sont spéciaux ; le point, la virgule et l'apostrophe ne le sont pas.
    expect(measureText("Il est 8 heures, c'est l'heure !").specialPer100).toBeCloseTo((2 / 7) * 100);
  });

  test("Should_ReturnZero_When_TextIsEmpty", () => {
    expect(measureText("")).toEqual({ wordLength: 0, specialPer100: 0 });
  });
});

describe("textComplexity", () => {
  test.each([
    ["fr", "Le chat gris dort sur le lit."],
    ["en", "The cat is on the mat and it is warm."],
  ] as const)("Should_BeEasy_When_ShortWordsWithoutSpecials_%s", (language, text) => {
    expect(textComplexity(text, language)).toBe("easy");
  });

  test.each([
    ["fr", "Les enfants regardent le film."],
    ["en", "The students played games at night."],
  ] as const)("Should_BeMedium_When_WordsAreLongerButNoSpecials_%s", (language, text) => {
    expect(textComplexity(text, language)).toBe("medium");
  });

  test.each([
    ["fr", "Particulièrement, les gouvernements internationaux anticipent."],
    ["en", "Researchers systematically investigated extraordinary phenomena."],
  ] as const)("Should_BeHard_When_WordsAreLong_%s", (language, text) => {
    expect(textComplexity(text, language)).toBe("hard");
  });

  test("Should_BeHard_When_ManySpecialCharactersEvenWithShortWords", () => {
    expect(textComplexity("Le 12 mai, à 8 h, il a vu 3 ours !", "fr")).toBe("hard");
  });

  test("Should_BeMedium_When_ShortWordsWithSomeSpecialCharacters", () => {
    // 1 caractère spécial sur 20 mots : 5 pour 100, entre les deux seuils.
    const text = "Le chat dort sur le lit, et le chien dort sous la table de la cuisine ; la nuit est calme.";
    expect(textComplexity(text, "fr")).toBe("medium");
  });

  test("Should_UseLanguageThresholds_When_SameWordLengthInBothLanguages", () => {
    // 4,5 lettres par mot : moyen en anglais, facile en français.
    const text = "abcd abcde abcd abcde";
    expect(textComplexity(text, "en")).toBe("medium");
    expect(textComplexity(text, "fr")).toBe("easy");
  });
});

describe("applyTextOptions", () => {
  const sample = "À 8 h, Élise dit : « C'est peut-être l'été ! » Il fait 30 °C.";

  test("Should_KeepTextAsWritten_When_AllOptionsAreOn", () => {
    expect(applyTextOptions(sample, ALL_TEXT_OPTIONS)).toBe(sample);
  });

  test("Should_RemovePunctuationButKeepInnerApostropheAndHyphen_When_PunctuationIsOff", () => {
    expect(applyTextOptions(sample, { ...ALL_TEXT_OPTIONS, punctuation: false })).toBe(
      "À 8 h Élise dit C'est peut-être l'été Il fait 30 C",
    );
  });

  test("Should_RemoveWordsWithDigits_When_NumbersAreOff", () => {
    expect(applyTextOptions("Le 2e but à 8h30, en 2025.", { ...ALL_TEXT_OPTIONS, numbers: false })).toBe(
      "Le but à en",
    );
  });

  test("Should_Lowercase_When_CapitalsAreOff", () => {
    expect(applyTextOptions("Élise et Noé vont à Québec.", { ...ALL_TEXT_OPTIONS, capitals: false })).toBe(
      "élise et noé vont à québec.",
    );
  });

  test("Should_RemoveAccentsCedillaAndLigatures_When_AccentsAreOff", () => {
    expect(
      applyTextOptions("Ça, c'est un cœur à Noël : élève, fête, où.", { ...ALL_TEXT_OPTIONS, accents: false }),
    ).toBe("Ca, c'est un coeur a Noel : eleve, fete, ou.");
  });

  test("Should_LeaveOnlyLowercaseLetters_When_AllOptionsAreOff", () => {
    expect(
      applyTextOptions(sample, { punctuation: false, numbers: false, capitals: false, accents: false }),
    ).toBe("a h elise dit c'est peut-etre l'ete il fait c");
  });

  test("Should_ReturnEmptyString_When_TextIsEmpty", () => {
    expect(applyTextOptions("", { punctuation: false, numbers: false, capitals: false, accents: false })).toBe("");
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

  test.each(COMPLEXITIES)("Should_ReturnTextOfComplexity_When_ComplexityIs_%s", async (complexity) => {
    const picked = await pickText("fr", 50, complexity);

    const [source] = await db.select().from(texts).where(eq(texts.id, picked!.textId));
    expect(source.complexity).toBe(complexity);
  });

  test("Should_ApplyOptionsAfterCut_When_OptionsAreOff", async () => {
    const options = { punctuation: false, numbers: false, capitals: false, accents: false };

    const picked = await pickText("fr", 100, "hard", options);

    const [source] = await db.select().from(texts).where(eq(texts.id, picked!.textId));
    expect(picked!.content).toBe(applyTextOptions(cutText(source.content, 100), options));
  });
});

test("Should_StoreComputedComplexity_When_BankIsSeeded", async () => {
  const bank = await db.select().from(texts);

  for (const text of bank) {
    expect({ title: text.title, complexity: textComplexity(text.content, text.language) }).toEqual({
      title: text.title,
      complexity: text.complexity,
    });
  }
});

test.each(["fr", "en"] as const)(
  "Should_HaveThreeTextsPerComplexity_When_BankIsSeeded_%s",
  async (language) => {
    for (const complexity of COMPLEXITIES) {
      const bank = await db
        .select()
        .from(texts)
        .where(and(eq(texts.language, language), eq(texts.complexity, complexity)));
      expect(bank.length).toBeGreaterThanOrEqual(3);
    }
  },
);

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
