import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { LobbyExplorer } from "../components/lobby-explorer";
import type { ExplorerLobby } from "../lib/socket-messages";
import en from "../messages/en.json";
import fr from "../messages/fr.json";

type Handler = (...args: unknown[]) => void;

// Faux socket : garde les écouteurs pour simuler les messages du serveur.
const handlers: Record<string, Handler> = {};
const socket = {
  on: vi.fn((event: string, handler: Handler) => (handlers[event] = handler)),
  emit: vi.fn(),
  emitWithAck: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock("socket.io-client", () => ({ io: () => socket }));

const router = { replace: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

// L'action serveur crée la course publique ; ici, on vérifie seulement le formulaire.
vi.mock("../app/actions/lobbies", () => ({ createLobbyAction: vi.fn() }));

const french: ExplorerLobby = {
  code: "AAAAAA",
  hostName: "alex",
  participantCount: 3,
  capacity: 8,
  textLanguage: "fr",
  textComplexity: "easy",
  state: "waiting",
};
const english: ExplorerLobby = {
  code: "BBBBBB",
  hostName: "sam",
  participantCount: 2,
  capacity: 30,
  textLanguage: "en",
  textComplexity: "hard",
  state: "racing",
};

function renderExplorer(
  language?: "fr" | "en",
  locale: "fr" | "en" = "fr",
  complexity?: ExplorerLobby["textComplexity"],
  canCreate = true,
) {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      <LobbyExplorer language={language} complexity={complexity} canCreate={canCreate} />
    </NextIntlClientProvider>,
  );
  act(() => handlers["connect"]());
}

function sendList(lobbies: ExplorerLobby[]) {
  act(() => handlers["lobbies:list"]({ lobbies }));
}

function rows() {
  return screen.queryAllByRole("listitem").map((item) => item.textContent);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

test("Should_WatchPublicLobbies_When_Connected", () => {
  renderExplorer();

  expect(socket.emit).toHaveBeenCalledWith("lobbies:watch");
});

test("Should_ShowLoading_When_ListNotReceivedYet", () => {
  renderExplorer();

  expect(screen.getByText("Chargement des courses…")).toBeTruthy();
});

test("Should_ShowCountCapacityLanguageComplexityAndState_When_ListReceived", () => {
  renderExplorer();

  sendList([french, english]);

  expect(rows()).toEqual([
    "Course de alex3/8 · Français · Facile · En attente",
    "Course de sam2/30 · Anglais · Difficile · En course",
  ]);
});

test("Should_ShowResultsState_When_RaceFinished", () => {
  renderExplorer(undefined, "en");

  sendList([{ ...english, state: "finished" }]);

  expect(rows()).toEqual(["sam's race2/30 · English · Hard · Results"]);
});

test.each([
  ["fr", ["Course de alex3/8 · Français · Facile · En attente"]],
  ["en", ["Course de sam2/30 · Anglais · Difficile · En course"]],
] as const)("Should_ShowOnlyLanguage_When_FilterIs%s", (language, expected) => {
  renderExplorer(language);

  sendList([french, english]);

  expect(rows()).toEqual(expected);
});

test("Should_ReplaceList_When_ServerSendsUpdate", () => {
  renderExplorer();
  sendList([french, english]);

  sendList([{ ...french, participantCount: 4 }]);

  expect(rows()).toEqual(["Course de alex4/8 · Français · Facile · En attente"]);
});

test("Should_ShowEmptyState_When_NoLobbyMatchesFilter", () => {
  renderExplorer("en");

  sendList([french]);

  expect(screen.getByText("Aucune course publique pour le moment.")).toBeTruthy();
});

test.each([
  ["en", "/lobbies?lang=en"],
  ["", "/lobbies"],
])("Should_PutFilterInUrl_When_LanguageChosen (%s)", (value, url) => {
  renderExplorer("fr");

  fireEvent.change(screen.getByLabelText("Langue du texte"), { target: { value } });

  expect(router.replace).toHaveBeenCalledWith(url);
});

test.each([
  ["easy", ["Course de alex3/8 · Français · Facile · En attente"]],
  ["hard", ["Course de sam2/30 · Anglais · Difficile · En course"]],
  ["medium", []],
] as const)("Should_ShowOnlyComplexity_When_FilterIs_%s", (complexity, expected) => {
  renderExplorer(undefined, "fr", complexity);

  sendList([french, english]);

  expect(rows()).toEqual(expected);
});

test("Should_CombineFilters_When_LanguageAndComplexityChosen", () => {
  renderExplorer("en", "fr", "easy");

  sendList([french, english, { ...english, code: "CCCCCC", hostName: "kim", textComplexity: "easy" }]);

  expect(rows()).toEqual(["Course de kim2/30 · Anglais · Facile · En course"]);
});

test.each([
  ["hard", "/lobbies?lang=fr&complexity=hard"],
  ["", "/lobbies?lang=fr"],
])("Should_KeepLanguageInUrl_When_ComplexityChosen (%s)", (value, url) => {
  renderExplorer("fr", "fr", "easy");

  fireEvent.change(screen.getByLabelText("Complexité"), { target: { value } });

  expect(router.replace).toHaveBeenCalledWith(url);
});

test("Should_KeepComplexityInUrl_When_LanguageChosen", () => {
  renderExplorer(undefined, "fr", "medium");

  fireEvent.change(screen.getByLabelText("Langue du texte"), { target: { value: "en" } });

  expect(router.replace).toHaveBeenCalledWith("/lobbies?lang=en&complexity=medium");
});

test("Should_GoToLobby_When_QuickRaceFindsOne", async () => {
  socket.emitWithAck.mockResolvedValue({ ok: true, code: "AAAAAA" });
  renderExplorer();

  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Course rapide" })));

  expect(socket.emitWithAck).toHaveBeenCalledWith("lobbies:quick");
  expect(router.push).toHaveBeenCalledWith("/lobbies/AAAAAA");
});

test("Should_OfferPublicLobby_When_NoQuickLobbyForRegisteredUser", async () => {
  socket.emitWithAck.mockResolvedValue({ ok: false, error: "noQuickLobby" });
  renderExplorer();

  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Course rapide" })));

  expect(screen.getByRole("status").textContent).toContain("Aucune course publique à rejoindre pour le moment.");
  const create = screen.getByRole("button", { name: "Créer une course publique →" });
  expect(create.closest("form")?.querySelector<HTMLInputElement>("[name=visibility]")?.value).toBe("public");
  expect(router.push).not.toHaveBeenCalled();
});

test("Should_ShowEmptyStateOnly_When_NoQuickLobbyForGuest", async () => {
  socket.emitWithAck.mockResolvedValue({ ok: false, error: "noQuickLobby" });
  renderExplorer(undefined, "fr", undefined, false);

  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Course rapide" })));

  expect(screen.getByRole("status").textContent).toContain("Aucune course publique à rejoindre pour le moment.");
  expect(screen.queryByRole("button", { name: "Créer une course publique →" })).toBeNull();
});
