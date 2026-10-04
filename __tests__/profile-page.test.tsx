import { beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import ProfilePage from "../app/profile/[username]/page";
import { findProfileUser, listRaceHistory, type HistoryEntry } from "../lib/profile";
import { getCurrentUser } from "../lib/session-cookie";

vi.mock("../lib/session-cookie", () => ({ getCurrentUser: vi.fn() }));
vi.mock("../lib/profile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/profile")>()),
  findProfileUser: vi.fn(),
  listRaceHistory: vi.fn(),
}));

const alex = {
  id: "1",
  username: "alex",
  passwordHash: "hash",
  isGuest: false,
  car: "octane",
  boost: "standard",
  hat: "none",
  ball: "none",
  rankLevel: 0,
  createdAt: new Date(),
};
const sam = { ...alex, id: "2", username: "sam" };

function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    raceId: Math.random().toString(36).slice(2),
    date: new Date("2026-09-15T16:00:00Z"),
    textTitle: "Le hockey",
    content: "chat",
    rank: 1,
    wpm: 50,
    accuracy: 100,
    finished: true,
    bonusesEnabled: false,
    keyErrors: {},
    ...overrides,
  };
}

async function renderProfile(username = "alex") {
  render(await ProfilePage({ params: Promise.resolve({ username }) }));
}

function historyRows() {
  return within(screen.getByRole("table", { name: "Historique des courses" }))
    .getAllByRole("row")
    .slice(1)
    .map((row) => [...row.querySelectorAll("th, td")].map((cell) => cell.textContent));
}

beforeEach(() => {
  cleanup();
  vi.mocked(findProfileUser).mockResolvedValue(alex);
  vi.mocked(listRaceHistory).mockResolvedValue([]);
  vi.mocked(getCurrentUser).mockResolvedValue(null);
});

test("Should_ShowYouBadge_When_OwnerViewsTheirProfile", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(alex);

  await renderProfile();

  expect(screen.getByRole("heading", { level: 1, name: "alex" })).toBeDefined();
  expect(screen.getByText("Toi")).toBeDefined();
});

test("Should_HideYouBadge_When_AnotherUserVisits", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(sam);

  await renderProfile();

  expect(screen.getByRole("heading", { level: 1, name: "alex" })).toBeDefined();
  expect(screen.queryByText("Toi")).toBeNull();
});

test("Should_ShowProfile_When_VisitorIsLoggedOut", async () => {
  vi.mocked(listRaceHistory).mockResolvedValue([entry()]);

  await renderProfile();

  expect(screen.getByRole("heading", { level: 1, name: "alex" })).toBeDefined();
  expect(historyRows()).toHaveLength(1);
});

test("Should_ThrowNotFound_When_UsernameIsUnknown", async () => {
  vi.mocked(findProfileUser).mockResolvedValue(null);

  await expect(renderProfile("inconnu")).rejects.toMatchObject({
    digest: expect.stringContaining("404"),
  });
});

test("Should_ShowEmptyState_When_UserHasNoRace", async () => {
  await renderProfile();

  expect(screen.getByText("Aucune course pour l’instant.")).toBeDefined();
  expect(screen.getByText("Aucune faute enregistrée.")).toBeDefined();
  expect(screen.getAllByText("—")).toHaveLength(3);
});

test("Should_ShowGlobalStats_When_UserHasRaced", async () => {
  vi.mocked(listRaceHistory).mockResolvedValue([
    entry({ wpm: 40.4, accuracy: 90 }),
    entry({ wpm: 60, accuracy: 96 }),
  ]);

  await renderProfile();

  expect(screen.getByText("Meilleure vitesse (MPM)").nextSibling?.textContent).toBe("60");
  expect(screen.getByText("Vitesse moyenne (MPM)").nextSibling?.textContent).toBe("50");
  expect(screen.getByText("Précision moyenne").nextSibling?.textContent).toBe("93 %");
});

test("Should_ListEveryRace_When_UserHasRaced", async () => {
  vi.mocked(listRaceHistory).mockResolvedValue([
    entry({ rank: 2, wpm: 47.6, accuracy: 95.4 }),
    entry({
      textTitle: null,
      content: "un deux trois quatre cinq six sept huit",
      date: new Date("2026-09-14T16:00:00Z"),
      finished: false,
    }),
  ]);

  await renderProfile();

  expect(historyRows()).toEqual([
    ["15 sept. 2026", "Le hockey", "2", "48", "95 %"],
    ["14 sept. 2026", "un deux trois quatre cinq six…", "1", "50", "100 %"],
  ]);
});

test("Should_ListHardestKeys_When_UserMadeErrors", async () => {
  vi.mocked(listRaceHistory).mockResolvedValue([entry({ keyErrors: { é: 3, " ": 1 } })]);

  await renderProfile();

  const keys = within(screen.getByRole("list", { name: "Touches les plus difficiles" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);
  expect(keys).toEqual(["é3 fautes", "Espace1 faute"]);
});

test("Should_ShowProgressionEmptyState_When_NoRaceCounts", async () => {
  vi.mocked(listRaceHistory).mockResolvedValue([entry({ finished: false })]);

  await renderProfile();

  expect(screen.getByText("Termine une course sans bonus pour voir ta progression.")).toBeDefined();
  expect(screen.queryByRole("figure")).toBeNull();
});

test("Should_ShowSpeedAndAccuracyCharts_When_UserHasFinishedRaces", async () => {
  vi.mocked(listRaceHistory).mockResolvedValue([entry({ wpm: 60 }), entry({ wpm: 40 })]);

  await renderProfile();

  const progression = screen.getByRole("region", { name: "Progression" });
  expect(within(progression).getByText("2 dernières courses, sans bonus.")).toBeDefined();
  const captions = within(progression)
    .getAllByRole("figure")
    .map((figure) => figure.querySelector("figcaption")?.textContent);
  expect(captions).toEqual(["MPM", "Précision"]);
});
