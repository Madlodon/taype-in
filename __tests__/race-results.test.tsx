import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { RaceResults } from "../components/race-results";
import type { RaceResult } from "../lib/socket-messages";
import en from "../messages/en.json";
import fr from "../messages/fr.json";

function result(rank: number, overrides: Partial<RaceResult> = {}): RaceResult {
  return {
    id: `u${rank}`,
    username: `joueur${rank}`,
    rank,
    wpm: 60 - rank,
    accuracy: 100,
    durationMs: 40_000 + rank * 1000,
    penaltyMs: 0,
    errors: 0,
    finished: true,
    keyErrors: {},
    ...overrides,
  };
}

function renderResults(results: RaceResult[], locale: "fr" | "en" = "fr", userId = "u2") {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      <RaceResults results={results} userId={userId} />
    </NextIntlClientProvider>,
  );
}

function podium() {
  return within(screen.getByRole("list", { name: "Podium" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);
}

// Cellules de chaque ligne du classement, sans l'en-tête.
function rows() {
  return within(screen.getByRole("table", { name: /Classement complet|Full ranking/ }))
    .getAllByRole("row")
    .slice(1)
    .map((row) => [...row.querySelectorAll("th, td")].map((cell) => cell.textContent));
}

afterEach(() => {
  cleanup();
});

test("Should_ShowOnlyTopThreeOnPodium_When_MoreRacersFinished", () => {
  renderResults([1, 2, 3, 4].map((rank) => result(rank)));

  expect(podium()).toEqual(["joueur159 MPM1", "joueur2 (toi)58 MPM2", "joueur357 MPM3"]);
});

test("Should_ShowEveryPlayerWithStats_When_RaceIsOver", () => {
  renderResults([
    result(1, { wpm: 52.6, accuracy: 97.4, durationMs: 41_250, errors: 2 }),
    result(2),
    result(3),
    result(4),
  ]);

  expect(rows()).toHaveLength(4);
  expect(rows()[0]).toEqual(["1", "joueur1", "53", "97 %", "41,3 s", "2"]);
});

test("Should_ShowPenalty_When_ModeIsTolerant", () => {
  renderResults([result(1, { durationMs: 40_000, errors: 3, penaltyMs: 3000 })]);

  expect(rows()[0][4]).toBe("40 s (+3 s)");
});

test("Should_SayNotFinishedWithoutTime_When_RacerDidNotFinish", () => {
  renderResults([result(1), result(2, { finished: false, penaltyMs: 2000 })]);

  expect(rows()[1][4]).toBe("Non terminé");
});

test("Should_HighlightOwnRow_When_UserRaced", () => {
  renderResults([result(1), result(2)]);

  const ownRow = screen.getByRole("row", { name: /joueur2 \(toi\)/ });
  expect(ownRow.className).toContain("ranking-you");
});

test("Should_ShowPodiumWithFewerSteps_When_OnlyTwoRaced", () => {
  renderResults([result(1), result(2)]);

  expect(podium()).toHaveLength(2);
});

test("Should_ShowResultsInEnglish_When_LocaleIsEnglish", () => {
  renderResults([result(1, { durationMs: 41_250, accuracy: 97.4, finished: false })], "en");

  expect(screen.getByRole("heading", { name: "Results" })).toBeTruthy();
  expect(rows()[0]).toEqual(["1", "joueur1", "59", "97%", "Not finished", "0"]);
  expect(podium()).toEqual(["joueur159 WPM1"]);
});
