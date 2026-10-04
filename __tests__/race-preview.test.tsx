import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { RacePreview } from "../components/race-preview";
import { arenaPosition } from "../components/arena";
import { STADIUMS } from "../lib/garage-items";
import en from "../messages/en.json";
import fr from "../messages/fr.json";

function preview(locale: "en" | "fr" = "en") {
  render(<NextIntlClientProvider locale={locale} messages={locale === "en" ? en : fr}>
    <RacePreview />
  </NextIntlClientProvider>);
  return screen.getByRole("textbox");
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test.each(STADIUMS)("Should_UseSelectedStadiumThroughoutTypingAndRestart_When_%s", stadium => {
  const { container } = render(<NextIntlClientProvider locale="en" messages={en}>
    <RacePreview stadium={stadium} />
  </NextIntlClientProvider>);
  const arena = container.querySelector(".arena")!;
  const start = arena.querySelector("svg > g > g")!.getAttribute("transform");
  expect(arena.getAttribute("data-stadium")).toBe(stadium);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: en.Race.prompt } });
  expect(arena.querySelector("svg > g > g")!.getAttribute("transform")).not.toBe(start);
  fireEvent.click(screen.getByRole("button", { name: new RegExp(en.Race.restart) }));
  expect(arena.getAttribute("data-stadium")).toBe(stadium);
  expect(arena.querySelector("svg > g > g")!.getAttribute("transform")).toBe(start);
});

test("Should_StopAtFirstMistake_And_AdvanceAfterCorrection", () => {
  const input = preview();
  fireEvent.change(input, { target: { value: "Your X" } });
  const before = Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"));
  expect(before).toBe(Math.round(5 / en.Race.prompt.length * 100));
  fireEvent.change(input, { target: { value: "Your keyboard" } });
  expect(Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"))).toBeGreaterThan(before);
  expect(screen.getByRole("status").textContent).toBe("");
});

test.each(["en", "fr"] as const)("Should_ScoreAndReset_When_TextIsCompletedIn_%s", locale => {
  const messages = locale === "en" ? en : fr;
  const input = preview(locale);
  fireEvent.change(input, { target: { value: messages.Race.prompt } });
  expect(screen.getByRole("status").textContent).toContain(messages.Race.finished);
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
  expect((input as HTMLTextAreaElement).readOnly).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: new RegExp(messages.Race.restart) }));
  expect((input as HTMLTextAreaElement).value).toBe("");
  expect((input as HTMLTextAreaElement).readOnly).toBe(false);
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
  expect(document.activeElement).toBe(input);
});

test("Should_CountMistakesInAccuracy_After_Backspacing", () => {
  const input = preview();
  fireEvent.change(input, { target: { value: "X" } });
  fireEvent.change(input, { target: { value: "" } });
  fireEvent.change(input, { target: { value: "Y" } });
  expect(screen.getByText("Accuracy").parentElement?.textContent).toBe("Accuracy50 %");
});

test("Should_CalculateSpeed_FromElapsedTypingTime", () => {
  vi.spyOn(Date, "now").mockReturnValue(1000);
  const input = preview();
  fireEvent.change(input, { target: { value: "Y" } });
  vi.spyOn(Date, "now").mockReturnValue(61000);
  fireEvent.change(input, { target: { value: en.Race.prompt.slice(0, 10) } });
  expect(screen.getByText("Words / min").parentElement?.textContent).toBe("Words / min2");
});

test("Should_KeepCarInsideArena_And_FollowFloorWallCeiling", () => {
  expect(arenaPosition(-1)).toEqual(arenaPosition(0));
  expect(arenaPosition(2)).toEqual(arenaPosition(1));
  expect(arenaPosition(0.49).y).toBeLessThan(arenaPosition(0).y);
  expect(arenaPosition(0.78).x).toBeLessThan(arenaPosition(0.59).x);
});
