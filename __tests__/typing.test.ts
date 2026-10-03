import { describe, expect, test } from "vitest";
import { applyInput, EMPTY_TYPING, type ErrorMode, type Typing } from "../lib/typing";

const TEXT = "chat";

// Tape les valeurs successives du champ, comme le ferait le joueur.
function type(mode: ErrorMode, ...values: string[]): Typing {
  return values.reduce((state, value) => applyInput(state, TEXT, mode, value), EMPTY_TYPING);
}

describe.each<ErrorMode>(["blocking", "tolerant"])("applyInput (%s)", (mode) => {
  test("Should_AdvanceWithoutError_When_CharacterIsRight", () => {
    expect(type(mode, "c", "ch")).toMatchObject({ typed: "ch", errors: 0, blocked: false });
  });

  test("Should_CountError_When_CharacterIsWrong", () => {
    expect(type(mode, "x").errors).toBe(1);
  });

  test("Should_StopAtTextEnd_When_MoreIsTyped", () => {
    expect(type(mode, "chat!").typed).toBe("chat");
  });

  test("Should_IgnoreChange_When_MiddleOfInputIsEdited", () => {
    const state = type(mode, "ch");

    expect(applyInput(state, TEXT, mode, "xh")).toBe(state);
  });
});

describe("applyInput (blocking)", () => {
  test("Should_KeepWrongCharacterOutAndBlock_When_CharacterIsWrong", () => {
    expect(type("blocking", "c", "cx")).toMatchObject({ typed: "c", errors: 1, blocked: true });
  });

  test("Should_CountEachAttempt_When_PlayerKeepsTypingWrong", () => {
    expect(type("blocking", "x", "y", "z")).toMatchObject({ typed: "", errors: 3, blocked: true });
  });

  test("Should_UnblockAndKeepError_When_RightCharacterFollows", () => {
    expect(type("blocking", "x", "c")).toMatchObject({ typed: "c", errors: 1, blocked: false });
  });

  test("Should_RefuseBackspace_When_EverythingTypedIsRight", () => {
    expect(type("blocking", "ch", "c").typed).toBe("ch");
  });
});

describe("applyInput (tolerant)", () => {
  test("Should_KeepWrongCharacterAndContinue_When_CharacterIsWrong", () => {
    expect(type("tolerant", "x", "xh")).toMatchObject({ typed: "xh", errors: 1, blocked: false });
  });

  test("Should_CountEveryWrongCharacter_When_SeveralAreTyped", () => {
    expect(type("tolerant", "x", "xy", "xyz").errors).toBe(3);
  });

  test("Should_EraseLastCharacter_When_BackspaceIsPressed", () => {
    expect(type("tolerant", "x", "").typed).toBe("");
  });

  test("Should_KeepCountingError_When_ErrorIsCorrected", () => {
    expect(type("tolerant", "x", "", "c")).toMatchObject({ typed: "c", errors: 1, blocked: false });
  });

  test("Should_CountAgain_When_CorrectionIsAlsoWrong", () => {
    expect(type("tolerant", "x", "", "y").errors).toBe(2);
  });

  test("Should_FinishWithErrors_When_EndIsReachedUncorrected", () => {
    expect(type("tolerant", "chit")).toMatchObject({ typed: "chit", errors: 1, blocked: false });
  });
});

describe.each<ErrorMode>(["blocking", "tolerant"])("applyInput keys (%s)", (mode) => {
  test("Should_CountEveryCharacterKey_When_RightAndWrongAreTyped", () => {
    expect(type(mode, "c", "cx", "ch").keys).toBe(mode === "blocking" ? 3 : 2);
  });

  test("Should_CountErrorUnderExpectedCharacter_When_CharacterIsWrong", () => {
    expect(type(mode, "x").keyErrors).toEqual({ c: 1 });
  });

  test("Should_AddUpErrors_When_SameCharacterIsMissedTwice", () => {
    // En mode tolérant, il faut effacer la faute avant de retenter.
    const values = mode === "blocking" ? ["c", "cx", "cy"] : ["c", "cx", "c", "cy"];

    expect(type(mode, ...values).keyErrors).toEqual({ h: 2 });
  });

  test("Should_NotCountKeys_When_TextIsAlreadyFinished", () => {
    expect(type(mode, "chat!").keys).toBe(4);
  });
});
