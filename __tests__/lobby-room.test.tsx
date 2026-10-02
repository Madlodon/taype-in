import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { LobbyRoom } from "../components/lobby-room";
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

function renderRoom(locale: "fr" | "en" = "fr", isHost = false) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      <LobbyRoom code="K7P3XM" hostId="u1" isHost={isHost} />
    </NextIntlClientProvider>,
  );
}

function sendParticipants() {
  act(() =>
    handlers["lobby:participants"]({
      participants: [
        { id: "u1", username: "alex" },
        { id: "u2", username: "Invité-123456" },
      ],
    }),
  );
}

function listedNames() {
  return within(screen.getByRole("list", { name: "Participants" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("Should_JoinLobbyByCode_When_Mounted", () => {
  renderRoom();

  expect(socket.emit).toHaveBeenCalledWith(
    "lobby:join",
    { code: "K7P3XM" },
    expect.any(Function),
  );
});

test("Should_ShowParticipantsAndMarkHost_When_ServerSendsList", () => {
  renderRoom();

  sendParticipants();

  expect(listedNames()).toEqual(["alex (hôte)", "Invité-123456"]);
});

test("Should_MarkHostInEnglish_When_LocaleIsEnglish", () => {
  renderRoom("en");

  sendParticipants();

  expect(listedNames()).toEqual(["alex (host)", "Invité-123456"]);
});

test("Should_ShowError_When_JoinIsRefused", () => {
  renderRoom();
  const ack = socket.emit.mock.calls[0][2] as Handler;

  act(() => ack({ ok: false, error: "lobbyNotFound" }));

  expect(screen.getByRole("alert").textContent).toBe("Course introuvable");
});

test("Should_ShowRawMessage_When_ConnectionErrorHasNoTranslation", () => {
  renderRoom();

  act(() => handlers["connect_error"](new Error("xhr poll error")));

  expect(screen.getByRole("alert").textContent).toBe("xhr poll error");
});

test("Should_Disconnect_When_Unmounted", () => {
  const { unmount } = renderRoom();

  unmount();

  expect(socket.disconnect).toHaveBeenCalled();
});

test("Should_NotShowCloseButton_When_UserIsNotHost", () => {
  renderRoom();

  expect(screen.queryByRole("button", { name: "Fermer la course" })).toBeNull();
});

test("Should_AskServerToClose_When_HostConfirms", () => {
  vi.stubGlobal("confirm", vi.fn(() => true));
  renderRoom("fr", true);

  fireEvent.click(screen.getByRole("button", { name: "Fermer la course" }));

  expect(socket.emit).toHaveBeenCalledWith("lobby:close", expect.any(Function));
});

test("Should_NotClose_When_HostCancelsConfirmation", () => {
  vi.stubGlobal("confirm", vi.fn(() => false));
  renderRoom("fr", true);

  fireEvent.click(screen.getByRole("button", { name: "Fermer la course" }));

  expect(socket.emit).not.toHaveBeenCalledWith("lobby:close", expect.anything());
});

test("Should_ShowError_When_CloseIsRefused", () => {
  vi.stubGlobal("confirm", vi.fn(() => true));
  renderRoom("fr", true);
  fireEvent.click(screen.getByRole("button", { name: "Fermer la course" }));
  const ack = socket.emit.mock.calls[1][1] as Handler;

  act(() => ack({ ok: false, error: "notHost" }));

  expect(screen.getByRole("alert").textContent).toBe("Seul l'hôte peut faire ça");
});

test("Should_ReturnToLobbyListWithMessage_When_LobbyIsClosed", () => {
  renderRoom();

  act(() => handlers["lobby:closed"]());

  expect(router.replace).toHaveBeenCalledWith("/lobbies?closed=1");
});
