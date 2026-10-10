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
    rawWpm: 62 - rank,
    accuracy: 100,
    durationMs: 40_000 + rank * 1000,
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
    wpmSeries: [],
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
    result(1, { wpm: 52.6, rawWpm: 55.4, accuracy: 97.4, durationMs: 41_250, errors: 2, bonuses: 1 }),
    result(2),
    result(3),
    result(4),
  ]);

  expect(rows()).toHaveLength(4);
  expect(rows()[0]).toEqual([
    "1",
    "joueur1",
    "53",
    "55",
    "97 %",
    "41,3 s",
    "2",
    "Terminé",
    "1",
    "Bronze I · Div. I =aucun changement",
  ]);
});

test("Should_ShowPenalty_When_ModeIsTolerant", () => {
  renderResults([result(1, { durationMs: 40_000, errors: 3, penaltyMs: 3000 })]);

  expect(rows()[0][5]).toBe("40 s (+3 s)");
});

test("Should_ShowStatusWithoutTime_When_RacerDidNotFinish", () => {
  renderResults([
    result(1),
    result(2, { finished: false, status: "timeUp", penaltyMs: 2000 }),
    result(3, { finished: false, status: "gaveUp" }),
  ]);

  expect(rows().map((row) => [row[5], row[7]])).toEqual([
    ["41 s", "Terminé"],
    ["—", "Temps écoulé"],
    ["—", "Abandon"],
  ]);
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
  renderResults(
    [result(1, { durationMs: 41_250, accuracy: 97.4, finished: false, status: "gaveUp" })],
    "en",
  );

  expect(screen.getByRole("heading", { name: "Results" })).toBeTruthy();
  expect(rows()[0]).toEqual([
    "1",
    "joueur1",
    "59",
    "61",
    "97%",
    "—",
    "0",
    "Gave up",
    "0",
    "Bronze I · Div. I =no change",
  ]);
  expect(podium()).toEqual(["joueur159 WPM1"]);
});

test("Should_ShowNewRankWithUpArrow_When_PlayerGainedADivision", () => {
  renderResults([result(1, { rankLevel: 30, rankChange: 1 })]);

  expect(rows()[0][9]).toBe("Or II · Div. III ▲monte d'une division");
});

test("Should_ShowDownArrow_When_PlayerLostADivision", () => {
  renderResults([result(1), result(2, { rankLevel: 4, rankChange: -1 })]);

  expect(rows()[1][9]).toBe("Bronze II · Div. I ▼descend d'une division");
});

test("Should_ShowSupersonicLegendWithoutDivision_When_PlayerIsAtTheTop", () => {
  renderResults([result(1, { rankLevel: 84, rankChange: 1 })], "en");

  expect(rows()[0][9]).toBe("Supersonic Legend ▲up a division");
});

test("Should_ShowEachPlayerPhoto_When_RaceIsOver", () => {
  renderResults([1, 2, 3, 4].map((rank) => result(rank)));

  const table = screen.getByRole("table", { name: "Classement complet" });
  const sources = [...table.querySelectorAll("tbody img")].map((img) => img.getAttribute("src"));
  expect(sources).toEqual(["/avatars/u1", "/avatars/u2", "/avatars/u3", "/avatars/u4"]);
  const podiumImages = screen.getByRole("list", { name: "Podium" }).querySelectorAll("img");
  expect(podiumImages).toHaveLength(3);
});

test("Should_MarkBotWithoutAvatarOrRank_When_BotRaced", () => {
  renderResults([
    result(1),
    result(2, { id: "b1", username: "Bot Expert 1", bot: { level: "expert", number: 1 } }),
  ]);

  expect(rows()[1][1]).toBe("Bot Expert 1Bot");
  expect(rows()[1][9]).toBe("—");
  expect(podium()[1]).toBe("Bot Expert 1Bot58 MPM2");
  expect(document.querySelectorAll("img.avatar")).toHaveLength(2);
});

test("Should_ShowXpGainedAndLevel_When_PlayerDidNotLevelUp", () => {
  renderResults([result(1), result(2, { xp: 160, xpGained: 20 })]);

  expect(screen.getByRole("status").textContent).toBe("+20 XPNiveau 2");
});

test("Should_ShowLevelUpAndUnlockedItems_When_PlayerReachedNewLevel", () => {
  // 280 → 380 XP : du niveau 2 au niveau 3, qui débloque Flammes.
  renderResults([result(1, { xp: 380, xpGained: 100 }), result(2)], "fr", "u1");

  const status = screen.getByRole("status");
  expect(status.textContent).toBe("+100 XPNiveau supérieur ! Niveau 3Débloqué : Flammes. Voir au garage");
  expect(within(status).getByRole("link", { name: "Voir au garage" }).getAttribute("href")).toBe("/garage");
});

test("Should_ShowNoXp_When_PlayerIsGuest", () => {
  renderResults([result(1), result(2, { xp: null })]);

  expect(screen.queryByRole("status")).toBeNull();
});
