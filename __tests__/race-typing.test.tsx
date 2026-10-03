import { afterEach, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { RaceTyping } from "../components/race-typing";
import type { ErrorMode } from "../lib/typing";
import en from "../messages/en.json";
import fr from "../messages/fr.json";

function renderTyping(errorMode: ErrorMode, content = "chat", locale: "fr" | "en" = "fr") {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      <RaceTyping content={content} errorMode={errorMode} />
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

afterEach(() => {
  cleanup();
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
