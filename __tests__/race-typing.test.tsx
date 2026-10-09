import { act } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { RaceTyping } from "../components/race-typing";
import { EMPTY_TYPING, type ErrorMode, type Typing } from "../lib/typing";
import en from "../messages/en.json";
import fr from "../messages/fr.json";

function renderTyping(
  errorMode: ErrorMode,
  content = "chat",
  locale: "fr" | "en" = "fr",
  initial?: Typing,
) {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      <RaceTyping content={content} errorMode={errorMode} initial={initial} startedAt={Date.now()} />
    </NextIntlClientProvider>,
  );
  return screen.getByRole("textbox") as HTMLTextAreaElement;
}

function type(input: HTMLTextAreaElement, ...values: string[]) {
  for (const value of values) fireEvent.change(input, { target: { value } });
}

// Lettres du texte mises en évidence comme fautives (ERR-2).
function wrongLetters() {
  return [...document.querySelectorAll(".typing-text .typed-wrong")].map((letter) => letter.textContent);
}

const status = () => screen.getByRole("status").textContent;

// Ligne MPM et précision sous le champ (COURSE-04).
const live = () => screen.getByText(/MPM/).textContent;

// Avance l'horloge de la course, comme si le joueur réfléchissait avant la prochaine frappe.
function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

test("Should_ShowTextFieldAndNoError_When_RaceStarts", () => {
  const input = renderTyping("blocking");

  expect(screen.getByLabelText("chat")).toBeTruthy();
  expect(document.activeElement).toBe(input);
  expect(status()).toBe("Aucune faute");
});

test.each<ErrorMode>(["blocking", "tolerant"])("Should_ExplainMode_When_ModeIs_%s", (mode) => {
  renderTyping(mode);

  expect(screen.getByText(fr.RaceTyping[mode])).toBeTruthy();
});

test("Should_HighlightExpectedLetterAndNotAdvance_When_BlockingAndWrong", () => {
  const input = renderTyping("blocking");

  type(input, "c", "cx");

  expect(input.value).toBe("c");
  expect(wrongLetters()).toEqual(["h"]);
  expect(status()).toBe("1 faute");
});

test("Should_ClearHighlightAndKeepError_When_BlockingAndRightLetterFollows", () => {
  const input = renderTyping("blocking");

  type(input, "x", "c");

  expect(input.value).toBe("c");
  expect(wrongLetters()).toEqual([]);
  expect(status()).toBe("1 faute");
});

test("Should_HighlightWrongLetterAndContinue_When_TolerantAndWrong", () => {
  const input = renderTyping("tolerant");

  type(input, "x", "xh");

  expect(input.value).toBe("xh");
  expect(wrongLetters()).toEqual(["c"]);
  expect(status()).toBe("1 faute");
});

test("Should_ClearHighlightAndKeepError_When_TolerantErrorIsCorrected", () => {
  const input = renderTyping("tolerant");

  type(input, "x", "", "c");

  expect(wrongLetters()).toEqual([]);
  expect(status()).toBe("1 faute");
});

test("Should_FinishAndLockField_When_WholeTextIsTyped", () => {
  const input = renderTyping("tolerant");

  type(input, "chit");

  expect(input.readOnly).toBe(true);
  expect(status()).toBe("Terminé ! 1 faute.");
});

test("Should_CountErrorsInEnglish_When_LocaleIsEnglish", () => {
  const input = renderTyping("tolerant", "chat", "en");

  type(input, "x", "xy");

  expect(status()).toBe("2 errors");
});

test("Should_WaitForComposedLetter_When_AccentIsTypedWithDeadKey", () => {
  const input = renderTyping("blocking", "être");

  fireEvent.input(input, { target: { value: "^" }, isComposing: true });
  expect(input.value).toBe("^");
  expect(status()).toBe("Aucune faute");

  input.value = "ê";
  fireEvent.compositionEnd(input);

  expect(input.value).toBe("ê");
  expect(status()).toBe("Aucune faute");
});

test("Should_ResumeTypedTextMistakesAndErrors_When_InitialTypingIsGiven", () => {
  const input = renderTyping("tolerant", "chat", "fr", { ...EMPTY_TYPING, typed: "cx", errors: 3 });

  expect(input.value).toBe("cx");
  expect(wrongLetters()).toEqual(["h"]);
  expect(status()).toBe("3 fautes");
});

test("Should_ContinueFromResumedText_When_RacerTypesAgain", () => {
  const input = renderTyping("blocking", "chat", "fr", { ...EMPTY_TYPING, typed: "ch", errors: 1 });

  type(input, "cha");

  expect(input.value).toBe("cha");
  expect(status()).toBe("1 faute");
});

test("Should_PutCursorAtEnd_When_ResumedFieldGetsFocus", () => {
  const input = renderTyping("blocking", "chat", "fr", { ...EMPTY_TYPING, typed: "ch", errors: 0 });

  expect(input.selectionStart).toBe(2);
});

test("Should_RemoveRewardWordFromInputAndPrompt_WithoutCountingItAsTyped", () => {
  const content = "Go. One two three four five.";
  let latest: Typing | undefined;
  const { rerender } = render(<NextIntlClientProvider locale="en" messages={en}>
    <RaceTyping content={content} errorMode="blocking" startedAt={Date.now()} onProgress={value => { latest = value; }} />
  </NextIntlClientProvider>);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  type(input, "Go. O");
  rerender(<NextIntlClientProvider locale="en" messages={en}>
    <RaceTyping content={content} errorMode="blocking" startedAt={Date.now()} removed={[{ start: 18, end: 23 }]}
      onProgress={value => { latest = value; }} />
  </NextIntlClientProvider>);
  expect(input.value).toBe("Go. O");
  expect(screen.getByLabelText("Go. One two three five.")).toBeTruthy();
  type(input, "Go. One two three five.");
  expect(input.readOnly).toBe(true);
  expect(latest?.typed).toBe(content);
  expect(latest?.keys).toBe(content.length - 5);
  expect(latest?.errors).toBe(0);
});

test("Should_ShowZeroWpmAndAccuracy_When_NothingIsTypedYet", () => {
  renderTyping("blocking");

  expect(live()).toBe("0 MPM · Précision 0 %");
});

test("Should_UpdateWpmAndAccuracy_When_RacerTypes", () => {
  vi.useFakeTimers();
  const input = renderTyping("blocking", "chat chat");

  wait(6000);
  type(input, "c", "ch");

  // 2 caractères justes en 6 s : (2 ÷ 5) ÷ 0,1 min = 4 MPM.
  expect(live()).toBe("4 MPM · Précision 100 %");

  type(input, "chx");

  expect(live()).toBe("4 MPM · Précision 67 %");
});

test("Should_LowerWpm_When_TimePassesWithoutTyping", () => {
  vi.useFakeTimers();
  const input = renderTyping("blocking", "chat chat");

  wait(6000);
  type(input, "ch");
  wait(6000);

  expect(live()).toBe("2 MPM · Précision 100 %");
});

test("Should_KeepFinalWpm_When_TextIsFinished", () => {
  vi.useFakeTimers();
  const input = renderTyping("tolerant");

  wait(6000);
  type(input, "chat");
  wait(60_000);

  expect(live()).toBe("8 MPM · Précision 100 %");
});

test("Should_CountOnlyCorrectCharactersInWpm_When_TolerantLeavesErrors", () => {
  vi.useFakeTimers();
  const input = renderTyping("tolerant");

  wait(6000);
  type(input, "cx");

  expect(live()).toBe("2 MPM · Précision 50 %");
});

test("Should_ShowWpmAndAccuracyInEnglish_When_LocaleIsEnglish", () => {
  renderTyping("blocking", "chat", "en");

  expect(screen.getByText("0 WPM · Accuracy 0%")).toBeTruthy();
});
