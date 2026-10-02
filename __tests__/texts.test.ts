// @vitest-environment node
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";
import { texts } from "../db/schema";
import { cutText, pickText, TEXT_LENGTHS } from "../lib/texts";

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
