import { describe, expect, test } from "vitest";
import {
  addWords,
  availableEffects,
  BONUS_EFFECTS,
  checkpointsPassed,
  isBehind,
  shuffleNextWord,
} from "../lib/race-bonuses";

const content = "Un deux trois. Quatre cinq.";

describe("checkpointsPassed", () => {
  test.each([
    [0, 0],
    [0.24, 0],
    [0.25, 1],
    [0.5, 2],
    [0.74, 2],
    [0.75, 3],
    [1, 3],
  ])("Should_Count_When_LeaderIsAt_%s", (leader, passed) => {
    expect(checkpointsPassed(leader)).toBe(passed);
  });
});

describe("isBehind", () => {
  test("Should_BeBehind_When_Last", () => {
    const progress = [0.4, 0.35, 0.3];

    expect(progress.map((mine) => isBehind(progress, mine))).toEqual([false, false, true]);
  });

  test("Should_BeBehind_When_MoreThanQuarterBehindLeader", () => {
    const progress = [0.8, 0.5, 0.54, 0.2];

    expect(progress.map((mine) => isBehind(progress, mine))).toEqual([false, true, true, true]);
  });

  test("Should_NotBeBehind_When_ExactlyQuarterBehindAndNotLast", () => {
    expect(isBehind([0.75, 0.5, 0.1], 0.5)).toBe(false);
  });

  test("Should_GiveNobody_When_EveryoneIsTied", () => {
    expect(isBehind([0.5, 0.5], 0.5)).toBe(false);
  });

  test("Should_GiveNobody_When_RacingAlone", () => {
    expect(isBehind([0.3], 0.3)).toBe(false);
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
