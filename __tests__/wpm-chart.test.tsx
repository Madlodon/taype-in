import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { WpmChart } from "../components/wpm-chart";
import type { RaceResult } from "../lib/socket-messages";
import en from "../messages/en.json";
import fr from "../messages/fr.json";

function result(rank: number, wpmSeries: number[]): RaceResult {
  return {
    id: `u${rank}`,
    username: `joueur${rank}`,
    rank,
    wpm: 50,
    rawWpm: 50,
    accuracy: 100,
    durationMs: 40_000,
    penaltyMs: 0,
    errors: 0,
    finished: true,
    status: "finished",
    bonuses: 0,
    keyErrors: {},
    rankLevel: 0,
    rankChange: 0,
    xp: 0,
    xpGained: 0,
    wpmSeries,
  };
}

function renderChart(results: RaceResult[], locale: "fr" | "en" = "fr", userId = "u2") {
  const { container } = render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      <WpmChart results={results} userId={userId} />
    </NextIntlClientProvider>,
  );
  return container;
}

afterEach(() => {
  cleanup();
});

test("Should_DrawOneLinePerRacer_When_RacersHaveSeries", () => {
  const container = renderChart([result(1, [10, 40, 60]), result(2, [5, 30])]);

  expect(screen.getByRole("heading", { name: "MPM dans le temps" })).toBeTruthy();
  expect(container.querySelectorAll(".recharts-line")).toHaveLength(2);
  expect(screen.getByText("joueur1")).toBeTruthy();
  expect(screen.getByText("joueur2")).toBeTruthy();
});

test("Should_HighlightOwnLine_When_PlayerRaced", () => {
  const container = renderChart([result(1, [10, 40]), result(2, [5, 30])]);

  const strokes = [...container.querySelectorAll(".recharts-line-curve")].map((path) => path.getAttribute("stroke"));
  expect(strokes).toEqual(["#1a5fd0", "var(--accent)"]);
});

test("Should_ShowNote_When_RaceWasTooShortForAnySample", () => {
  const container = renderChart([result(1, []), result(2, [])], "en");

  expect(screen.getByText("Race too short to draw the chart.")).toBeTruthy();
  expect(container.querySelector(".recharts-wrapper")).toBeNull();
});
