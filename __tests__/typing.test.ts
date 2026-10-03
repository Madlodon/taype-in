import { describe, expect, test } from "vitest";
import { applyInput, EMPTY_TYPING, type ErrorMode, type Typing } from "../lib/typing";

const TEXT = "chat";

// Tape les valeurs successives du champ, comme le ferait le joueur.
function type(mode: ErrorMode, ...values: string[]): Typing {
  return values.reduce((state, value) => applyInput(state, TEXT, mode, value), EMPTY_TYPING);
}

describe.each<ErrorMode>(["blocking", "tolerant"])("applyInput (%s)", (mode) => {
  test("Should_AdvanceWithoutError_When_CharacterIsRight", () => {
    expect(type(mode, "c", "ch")).toEqual({ typed: "ch", errors: 0, blocked: false });
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
    expect(type("blocking", "c", "cx")).toEqual({ typed: "c", errors: 1, blocked: true });
  });

  test("Should_CountEachAttempt_When_PlayerKeepsTypingWrong", () => {
    expect(type("blocking", "x", "y", "z")).toEqual({ typed: "", errors: 3, blocked: true });
  });

  test("Should_UnblockAndKeepError_When_RightCharacterFollows", () => {
    expect(type("blocking", "x", "c")).toEqual({ typed: "c", errors: 1, blocked: false });
  });

  test("Should_RefuseBackspace_When_EverythingTypedIsRight", () => {
    expect(type("blocking", "ch", "c").typed).toBe("ch");
  });
});

describe("applyInput (tolerant)", () => {
  test("Should_KeepWrongCharacterAndContinue_When_CharacterIsWrong", () => {
    expect(type("tolerant", "x", "xh")).toEqual({ typed: "xh", errors: 1, blocked: false });
  });

  test("Should_CountEveryWrongCharacter_When_SeveralAreTyped", () => {
    expect(type("tolerant", "x", "xy", "xyz").errors).toBe(3);
  });

  test("Should_EraseLastCharacter_When_BackspaceIsPressed", () => {
    expect(type("tolerant", "x", "").typed).toBe("");
  });

  test("Should_KeepCountingError_When_ErrorIsCorrected", () => {
    expect(type("tolerant", "x", "", "c")).toEqual({ typed: "c", errors: 1, blocked: false });
  });

  test("Should_CountAgain_When_CorrectionIsAlsoWrong", () => {
    expect(type("tolerant", "x", "", "y").errors).toBe(2);
  });

  test("Should_FinishWithErrors_When_EndIsReachedUncorrected", () => {
    expect(type("tolerant", "chit")).toEqual({ typed: "chit", errors: 1, blocked: false });
  });
});
