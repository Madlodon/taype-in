import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test.each(STADIUMS)("Should_UseSelectedStadiumThroughoutTypingAndRestart_When_%s", stadium => {
  const { container } = render(<NextIntlClientProvider locale="en" messages={en}>
    <RacePreview stadium={stadium} />
  </NextIntlClientProvider>);
  const arena = container.querySelector(".arena")!;
  const start = arena.querySelector("svg > g > g > g")!.getAttribute("transform");
  expect(arena.getAttribute("data-stadium")).toBe(stadium);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: en.Race.prompt } });
  // Typing progress no longer teleports the independently driving car.
  expect(arena.querySelector("svg > g > g > g")!.getAttribute("transform")).toBe(start);
  fireEvent.click(screen.getByRole("button", { name: new RegExp(en.Race.restart) }));
  expect(arena.getAttribute("data-stadium")).toBe(stadium);
  expect(arena.querySelector("svg > g > g > g")!.getAttribute("transform")).toBe(start);
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


test("Should_BoostOnCorrectTrainingInput_And_ExpireRefreshAndResetTheEffect", () => {
  let tick: FrameRequestCallback = () => {};
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { tick = callback; return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  const clock = vi.spyOn(performance, "now").mockReturnValue(0);
  const input = preview();
  const exhaust = () => document.querySelector('[data-car-id="preview"] .car-boost');
  expect(exhaust()).toBeNull();
  clock.mockReturnValue(100);
  fireEvent.change(input, { target: { value: "Y" } });
  act(() => tick(110));
  expect(exhaust()).not.toBeNull();
  clock.mockReturnValue(400);
  fireEvent.change(input, { target: { value: "Yo" } });
  act(() => tick(500));
  expect(exhaust()).not.toBeNull();
  act(() => tick(751));
  expect(exhaust()).toBeNull();
  clock.mockReturnValue(800);
  fireEvent.change(input, { target: { value: "YoX" } });
  act(() => tick(810));
  expect(exhaust()).toBeNull();
  fireEvent.change(input, { target: { value: "Yo" } });
  act(() => tick(820));
  expect(exhaust()).toBeNull();
  fireEvent.change(input, { target: { value: "You" } });
  act(() => tick(830));
  expect(exhaust()).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: new RegExp(en.Race.restart) }));
  expect(exhaust()).toBeNull();
});

function addBot(level: string) {
  fireEvent.change(screen.getByRole("combobox", { name: en.LobbyRoom.botLevel }), { target: { value: level } });
  fireEvent.click(screen.getByRole("button", { name: en.LobbyRoom.addBot }));
}

function botsList() {
  return screen.queryByRole("list", { name: en.Race.botsList });
}

test("Should_AddAndRemoveTrainingBots_When_ChoosingTheirLevel", () => {
  preview();
  addBot("expert");
  addBot("noob");
  addBot("expert");
  expect(botsList()!.textContent).toContain("Bot Expert 1");
  expect(botsList()!.textContent).toContain("Bot Noob 1");
  expect(botsList()!.textContent).toContain("Bot Expert 2");
  expect(screen.getByRole("list", { name: en.LobbyRoom.ranking }).children).toHaveLength(4);
  fireEvent.click(screen.getByRole("button", { name: `${en.LobbyRoom.removeBot} Bot Expert 1` }));
  expect(botsList()!.textContent).not.toContain("Bot Expert 1");
  expect(botsList()!.children).toHaveLength(2);
});

test("Should_DisableAdding_When_TenBotsAreInTraining", () => {
  preview();
  for (let index = 0; index < 11; index++) addBot("beginner");
  expect(botsList()!.children).toHaveLength(10);
  expect(screen.getByRole("heading", { name: "Bots (10/10)" })).toBeTruthy();
  expect((screen.getByRole("button", { name: en.LobbyRoom.addBot }) as HTMLButtonElement).disabled).toBe(true);
});

test("Should_MoveBotsAfterFirstKey_And_ResetThemOnRestart", () => {
  vi.useFakeTimers();
  try {
    const input = preview();
    addBot("impossible");
    const botRow = () => screen.getByRole("list", { name: en.LobbyRoom.ranking }).querySelector("li:not(.ranking-you)")!;
    act(() => { vi.advanceTimersByTime(5000); });
    expect(botRow().textContent).toContain("0%");
    fireEvent.change(input, { target: { value: "Y" } });
    // Bots can no longer be changed once the race has started.
    expect(botsList()).toBeNull();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(Number(botRow().textContent!.match(/(\d+)%/)![1])).toBeGreaterThan(0);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(botRow().textContent).toContain("100%");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en.Race.restart) }));
    expect(botRow().textContent).toContain("0%");
    expect(botsList()!.textContent).toContain("Bot Impossible 1");
  } finally {
    vi.useRealTimers();
  }
});
