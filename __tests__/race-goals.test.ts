import { expect, test } from "vitest";
import { completedSentences, thirdWordAhead, withoutRemoved, restoreRemoved } from "../lib/race-goals";

const content = "Go. One two three four five six.";

test("Should_RemoveThirdWordAfterCurrentWord_When_GoalLands", () => {
  const range = thirdWordAhead(content, content.indexOf("One") + 1, [])!;
  expect(withoutRemoved(content, [range])).toBe("Go. One two three five six.");
  expect(thirdWordAhead(content, 3, [])).toEqual({ start: 11, end: 17 });
});

test("Should_CountOnlyRemainingWords_And_KeepSentencePunctuation", () => {
  const first = thirdWordAhead(content, 5, [])!;
  const second = thirdWordAhead(content, 5, [first])!;
  const third = thirdWordAhead(content, 5, [first, second])!;
  expect(withoutRemoved(content, [first, second, third])).toBe("Go. One two three.");
  expect(thirdWordAhead(content, 5, [first, second, third])).toBeUndefined();
});

test("Should_NotRemoveAnything_When_ThereAreFewerThanThreeWordsAhead", () => {
  expect(thirdWordAhead(content, content.indexOf("five"), [])).toBeUndefined();
  expect(thirdWordAhead(content, content.length, [])).toBeUndefined();
});

test("Should_CountFrenchApostrophesAndHyphensAsOneWord", () => {
  const text = "Vas-y. L’été est très beau aujourd’hui.";
  expect(withoutRemoved(text, [thirdWordAhead(text, 8, [])!])).toBe("Vas-y. L’été est très aujourd’hui.");
});

test("Should_RestoreOffsetsWithoutRequiringRemovedLetters_When_TypingContinues", () => {
  const removed = [thirdWordAhead(content, 5, [])!];
  expect(restoreRemoved("Go. One two three five", content, removed)).toBe("Go. One two three four five");
  expect(restoreRemoved("Go. One", content, removed)).toBe("Go. One");
  expect(restoreRemoved(withoutRemoved(content, removed), content, removed)).toBe(content);
});

test("Should_RecognizeSentenceEndsWithoutDecimalPointsOrDuplicatePunctuation", () => {
  const text = 'Pay 1.5 now... Really?! "Yes." Next';
  expect(completedSentences(text, text)).toEqual([14, 23, 30]);
  expect(completedSentences(text, text.slice(0, 12))).toEqual([]);
  expect(completedSentences("Go. Next", "Gox")).toEqual([]);
});
