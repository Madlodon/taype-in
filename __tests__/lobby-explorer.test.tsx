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
  disconnect: vi.fn(),
};

vi.mock("socket.io-client", () => ({ io: () => socket }));

const router = { replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const french: ExplorerLobby = {
  code: "AAAAAA",
  hostName: "alex",
  participantCount: 3,
  capacity: 8,
  textLanguage: "fr",
  state: "waiting",
};
const english: ExplorerLobby = {
  code: "BBBBBB",
  hostName: "sam",
  participantCount: 2,
  capacity: 30,
  textLanguage: "en",
  state: "racing",
};

function renderExplorer(language?: "fr" | "en", locale: "fr" | "en" = "fr") {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      <LobbyExplorer language={language} canCreate />
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

test("Should_ShowCountCapacityLanguageAndState_When_ListReceived", () => {
  renderExplorer();

  sendList([french, english]);

  expect(rows()).toEqual([
    "Course de alex3/8 · Français · En attente",
    "Course de sam2/30 · Anglais · En course",
  ]);
});

test("Should_ShowResultsState_When_RaceFinished", () => {
  renderExplorer(undefined, "en");

  sendList([{ ...english, state: "finished" }]);

  expect(rows()).toEqual(["sam's race2/30 · English · Results"]);
});

test.each([
  ["fr", ["Course de alex3/8 · Français · En attente"]],
  ["en", ["Course de sam2/30 · Anglais · En course"]],
] as const)("Should_ShowOnlyLanguage_When_FilterIs%s", (language, expected) => {
  renderExplorer(language);

  sendList([french, english]);

  expect(rows()).toEqual(expected);
});

test("Should_ReplaceList_When_ServerSendsUpdate", () => {
  renderExplorer();
  sendList([french, english]);

  sendList([{ ...french, participantCount: 4 }]);

  expect(rows()).toEqual(["Course de alex4/8 · Français · En attente"]);
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
