import { afterEach, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { KeyboardHeatmap } from "../components/keyboard-heatmap";
import type { RaceResult } from "../lib/socket-messages";
import en from "../messages/en.json";
import fr from "../messages/fr.json";

function result(rank: number, keyErrors: Record<string, number>): RaceResult {
  return {
    id: `u${rank}`,
    username: `joueur${rank}`,
    rank,
    wpm: 50,
    accuracy: 95,
    durationMs: 40_000,
    penaltyMs: 0,
    errors: Object.values(keyErrors).reduce((sum, errors) => sum + errors, 0),
    finished: true,
    keyErrors,
    rankLevel: 0,
    rankChange: 0,
    xp: 0,
    xpGained: 0,
    wpmSeries: [],
  };
}

const RESULTS = [result(1, { a: 1, é: 2 }), result(2, { a: 3, " ": 1 })];

function renderHeatmap(userId: string, results = RESULTS, locale: "fr" | "en" = "fr") {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      <KeyboardHeatmap results={results} userId={userId} />
    </NextIntlClientProvider>,
  );
}

// La touche affichée (kbd) et la classe de couleur de sa case.
function keyCell(label: string) {
  const kbd = screen.getAllByText(label, { selector: "kbd" })[0];
  return kbd.parentElement!;
}

afterEach(() => {
  cleanup();
});

test("Should_ShowOwnErrors_When_PlayerRaced", () => {
  renderHeatmap("u2");

  expect((screen.getByRole("combobox", { name: "Afficher" }) as HTMLSelectElement).value).toBe("u2");
  expect(keyCell("a").textContent).toBe("a33 fautes");
  expect(keyCell("a").className).toContain("heat-4");
  expect(keyCell("Espace").className).toContain("heat-2");
  expect(screen.queryByText("é", { selector: "kbd" })).toBeNull();
});

test("Should_ShowWholeRace_When_ViewerDidNotRace", () => {
  renderHeatmap("spectator");

  expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("all");
  expect(keyCell("a").textContent).toBe("a44 fautes");
});

test("Should_SwitchPlayer_When_AnotherIsSelected", () => {
  renderHeatmap("u2");

  fireEvent.change(screen.getByRole("combobox"), { target: { value: "u1" } });

  expect(keyCell("a").textContent).toBe("a11 faute");
  expect(keyCell("a").className).toContain("heat-2");
  expect(keyCell("é").className).toContain("heat-4");
  expect(screen.getByRole("heading", { name: "Autres caractères" })).toBeTruthy();
});

test("Should_ColourNoKey_When_PlayerMadeNoError", () => {
  renderHeatmap("u1", [result(1, {})]);

  expect(screen.getByText("Aucune faute : une course parfaite !")).toBeTruthy();
  expect(document.querySelectorAll(".heat-1, .heat-2, .heat-3, .heat-4")).toHaveLength(0);
});

test("Should_ShowEnglishLabels_When_LocaleIsEnglish", () => {
  renderHeatmap("u2", RESULTS, "en");

  expect(screen.getByRole("heading", { name: "Keyboard heatmap" })).toBeTruthy();
  expect(screen.getByRole("option", { name: "Whole race" })).toBeTruthy();
  expect(keyCell("Space").textContent).toBe("Space11 error");
});
