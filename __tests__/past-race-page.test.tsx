import { beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import PastRacePage from "../app/races/[id]/page";
import { findPastRace, type Placement } from "../lib/results";
import { getCurrentUser } from "../lib/session-cookie";
import fr from "../messages/fr.json";

vi.mock("../lib/session-cookie", () => ({ getCurrentUser: vi.fn() }));
vi.mock("../lib/results", () => ({ findPastRace: vi.fn() }));

function placement(rank: number, overrides: Partial<Placement> = {}): Placement {
  return {
    id: `u${rank}`,
    username: `joueur${rank}`,
    rank,
    wpm: 60 - rank * 10,
    rawWpm: 60,
    accuracy: 98,
    durationMs: 30_000,
    penaltyMs: 0,
    errors: 1,
    finished: true,
    status: "finished",
    bonuses: 0,
    keyErrors: { e: 1 },
    wpmSeries: [20, 40],
    ...overrides,
  };
}

async function renderPage(id = "race-1") {
  render(
    <NextIntlClientProvider locale="fr" messages={fr} timeZone="America/Toronto">
      {await PastRacePage({ params: Promise.resolve({ id }) })}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  cleanup();
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  vi.mocked(findPastRace).mockResolvedValue({
    date: new Date("2026-09-15T16:00:00Z"),
    textTitle: "Le hockey",
    content: "chat",
    results: [placement(1), placement(2, { finished: false, status: "gaveUp" })],
  });
});

test("Should_ShowRaceTextAndDate_When_RaceExists", async () => {
  await renderPage();

  expect(screen.getByRole("heading", { level: 1, name: "Résultats de la course" })).toBeDefined();
  expect(screen.getByText(/^Le hockey · 15 sept\. 2026/)).toBeDefined();
});

test("Should_ShowFullRankingWithoutLevel_When_RaceExists", async () => {
  await renderPage();

  const table = screen.getByRole("table", { name: "Classement complet" });
  const headers = within(table).getAllByRole("columnheader").map((header) => header.textContent);
  expect(headers).not.toContain("Niveau");
  expect(within(table).getAllByRole("row").slice(1).map((row) => row.querySelector("th")?.textContent)).toEqual([
    "joueur1",
    "joueur2",
  ]);
  expect(screen.getByRole("list", { name: "Podium" })).toBeDefined();
});

test("Should_ShowChartAndHeatmap_When_RaceExists", async () => {
  await renderPage();

  expect(screen.getByRole("heading", { name: "MPM dans le temps" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Heatmap du clavier" })).toBeDefined();
});

test("Should_HighlightViewer_When_ViewerRaced", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({ id: "u2" } as Awaited<ReturnType<typeof getCurrentUser>>);

  await renderPage();

  expect(screen.getByRole("row", { name: /joueur2 \(toi\)/i }).className).toBe("ranking-you");
});

test("Should_ThrowNotFound_When_RaceIsUnknown", async () => {
  vi.mocked(findPastRace).mockResolvedValue(null);

  await expect(renderPage("inconnue")).rejects.toMatchObject({ digest: expect.stringContaining("404") });
});
