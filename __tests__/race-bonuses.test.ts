import { describe, expect, test } from "vitest";
import {
  addWords,
  availableEffects,
  BONUS_EFFECTS,
  isBonusEligible,
  shuffleNextWord,
} from "../lib/race-bonuses";

const content = "Un deux trois. Quatre cinq.";

describe("isBonusEligible", () => {
  test("Should_BeEligible_When_LastOfTwo", () => {
    expect(isBonusEligible([0.8, 0.2], 0.2)).toBe(true);
    expect(isBonusEligible([0.8, 0.2], 0.8)).toBe(false);
  });

  test("Should_KeepOnlyLeastAdvancedHalf_When_FourRacers", () => {
    const progress = [0.9, 0.6, 0.4, 0.1];

    expect(progress.map((mine) => isBonusEligible(progress, mine))).toEqual([false, false, true, true]);
  });

  test("Should_KeepOnlyLast_When_ThreeRacers", () => {
    const progress = [0.9, 0.5, 0.1];

    expect(progress.map((mine) => isBonusEligible(progress, mine))).toEqual([false, false, true]);
  });

  test("Should_GiveNobody_When_EveryoneIsTied", () => {
    expect(isBonusEligible([0.5, 0.5], 0.5)).toBe(false);
  });

  test("Should_GiveNobody_When_RacingAlone", () => {
    expect(isBonusEligible([0.3], 0.3)).toBe(false);
  });
});

describe("availableEffects", () => {
  test("Should_OfferEveryEffect_When_TargetIsHuman", () => {
    expect(availableEffects({ bot: false })).toEqual([...BONUS_EFFECTS]);
  });

  test("Should_SkipScreenEffects_When_TargetIsBot", () => {
    expect(availableEffects({ bot: true })).toEqual(["removeWords", "addWords", "slowLetters", "shuffleWord"]);
  });

  test("Should_OnlyRemoveWords_When_NoTarget", () => {
    expect(availableEffects(undefined)).toEqual(["removeWords"]);
  });
});

describe("addWords", () => {
  test("Should_InsertThreeWordsAfterCurrentWord_When_InMiddleOfWord", () => {
    // random = 0 : toujours le premier mot du texte.
    const added = addWords(content, 4, [], () => 0);

    expect(added.content).toBe("Un deux Un Un Un trois. Quatre cinq.");
  });

  test("Should_AppendWords_When_OnLastWord", () => {
    expect(addWords("Un deux", 5, [], () => 0).content).toBe("Un deux Un Un Un");
  });

  test("Should_ShiftLaterRemovedWords_When_WordsAreAdded", () => {
    const removed = [{ start: 0, end: 2 }, { start: 20, end: 26 }];

    const added = addWords(content, 4, removed, () => 0);

    expect(added.removed).toEqual([{ start: 0, end: 2 }, { start: 29, end: 35 }]);
    expect(added.content.slice(29, 35)).toBe(content.slice(20, 26));
  });
});

describe("shuffleNextWord", () => {
  test("Should_ShuffleFirstWordNotStarted_When_InMiddleOfWord", () => {
    const shuffled = shuffleNextWord(content, 4, [], () => 0)!;

    expect(shuffled.slice(0, 8)).toBe("Un deux ");
    expect(shuffled.slice(8, 13)).not.toBe("trois");
    expect([...shuffled.slice(8, 13)].sort()).toEqual([..."trois"].sort());
    expect(shuffled.slice(13)).toBe(content.slice(13));
  });

  test("Should_ChangeWord_When_ShuffleGivesSameOrder", () => {
    // random = 0.99 garde chaque lettre à sa place : la rotation change quand même le mot.
    expect(shuffleNextWord("ab cd", 0, [], () => 0.99)).toBe("ba cd");
  });

  test("Should_SkipRemovedWords_When_Shuffling", () => {
    const shuffled = shuffleNextWord(content, 4, [{ start: 7, end: 13 }], () => 0)!;

    expect(shuffled.slice(0, 15)).toBe(content.slice(0, 15));
    expect(shuffled.slice(15, 21)).not.toBe("Quatre");
  });

  test("Should_ReturnUndefined_When_NoWordLeft", () => {
    expect(shuffleNextWord(content, content.length, [], () => 0)).toBeUndefined();
  });
});
