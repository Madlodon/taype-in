import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
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

function renderRoom(locale: "fr" | "en" = "fr") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      <LobbyRoom code="K7P3XM" hostId="u1" />
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
