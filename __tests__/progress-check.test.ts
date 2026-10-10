import { describe, expect, test } from "vitest";
import { isPlausibleProgress, MAX_WPM } from "../lib/progress-check";

const TEXT = "le chat dort";
const START = { typed: "", errors: 0, keys: 0 };
// Assez de temps pour taper tout le texte à vitesse humaine.
const LONG_AGO = 60_000;

function progress(typed: string, errors = 0, keys = typed.length + errors) {
  return { typed, errors, keys };
}

describe("isPlausibleProgress", () => {
  test("Should_Accept_When_TypingIsRightAndHuman", () => {
    expect(isPlausibleProgress(START, progress("le ch"), TEXT, "blocking", [], LONG_AGO)).toBe(true);
  });

  test("Should_Accept_When_TolerantTypedHasCountedErrors", () => {
    expect(isPlausibleProgress(START, progress("le cx", 1, 5), TEXT, "tolerant", [], LONG_AGO)).toBe(true);
  });

  test("Should_Accept_When_TolerantPlayerErasesAndRetypes", () => {
    const before = progress("le cx", 1, 5);

    expect(isPlausibleProgress(before, progress("le ch", 1, 6), TEXT, "tolerant", [], LONG_AGO)).toBe(true);
  });

  test("Should_Accept_When_RemovedWordIsFilledWithoutKeys", () => {
    const before = progress("le ");

    expect(
      isPlausibleProgress(before, progress("le chat ", 0, 4), TEXT, "blocking", [{ start: 3, end: 8 }], LONG_AGO),
    ).toBe(true);
  });

  test("Should_Reject_When_BlockingTypedHasAWrongCharacter", () => {
    expect(isPlausibleProgress(START, progress("le cx", 1, 6), TEXT, "blocking", [], LONG_AGO)).toBe(false);
  });

  test("Should_Reject_When_WrongCharactersExceedErrors", () => {
    expect(isPlausibleProgress(START, progress("xx", 1, 2), TEXT, "tolerant", [], LONG_AGO)).toBe(false);
  });

  test("Should_Reject_When_TextJumpsAheadWithoutKeys", () => {
    const before = progress("le ");

    expect(isPlausibleProgress(before, progress("le chat ", 0, 4), TEXT, "blocking", [], LONG_AGO)).toBe(false);
  });

  test.each([
    ["keys go down", progress("le", 0, 1)],
    ["errors go down", progress("le", 0, 4)],
    ["more errors than keys", progress("", 5, 4)],
  ])("Should_Reject_When_%s", (_, after) => {
    const before = progress("l", 1, 3);

    expect(isPlausibleProgress(before, after, TEXT, "tolerant", [], LONG_AGO)).toBe(false);
  });

  test("Should_Accept_When_SpeedIsAtTheLimit", () => {
    // 300 mots/min = 25 touches/s, plus 10 touches de marge : 35 touches en 1 s.
    const typed = "a".repeat(35);

    expect(isPlausibleProgress(START, progress(typed), typed, "blocking", [], 1000, MAX_WPM)).toBe(true);
  });

  test("Should_Reject_When_SpeedIsAboveTheLimit", () => {
    const typed = "a".repeat(36);

    expect(isPlausibleProgress(START, progress(typed), typed, "blocking", [], 1000, MAX_WPM)).toBe(false);
  });

  test("Should_Accept_When_SpeedIsUnlimited", () => {
    const typed = "a".repeat(200);

    expect(isPlausibleProgress(START, progress(typed), typed, "blocking", [], 0, Infinity)).toBe(true);
  });

  test("Should_Reject_When_WholeTextArrivesRightAfterGo", () => {
    const typed = "a".repeat(200);

    expect(isPlausibleProgress(START, progress(typed), typed, "blocking", [], 100)).toBe(false);
  });
});
