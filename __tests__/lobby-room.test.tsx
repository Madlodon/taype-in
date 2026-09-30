import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { LobbyRoom } from "../components/lobby-room";

type Handler = (...args: unknown[]) => void;

// Faux socket : garde les écouteurs pour simuler les messages du serveur.
const handlers: Record<string, Handler> = {};
const socket = {
  on: vi.fn((event: string, handler: Handler) => (handlers[event] = handler)),
  emit: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock("socket.io-client", () => ({ io: () => socket }));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

test("Should_JoinLobbyByCode_When_Mounted", () => {
  render(<LobbyRoom code="K7P3XM" hostId="u1" />);

  expect(socket.emit).toHaveBeenCalledWith(
    "lobby:join",
    { code: "K7P3XM" },
    expect.any(Function),
  );
});

test("Should_ShowParticipantsAndMarkHost_When_ServerSendsList", () => {
  render(<LobbyRoom code="K7P3XM" hostId="u1" />);

  act(() =>
    handlers["lobby:participants"]({
      participants: [
        { id: "u1", username: "alex" },
        { id: "u2", username: "Invité-123456" },
      ],
    }),
  );

  const items = within(screen.getByRole("list", { name: "Participants" })).getAllByRole(
    "listitem",
  );
  expect(items.map((item) => item.textContent)).toEqual(["alex (hôte)", "Invité-123456"]);
});

test("Should_ShowError_When_JoinIsRefused", () => {
  render(<LobbyRoom code="K7P3XM" hostId="u1" />);
  const ack = socket.emit.mock.calls[0][2] as Handler;

  act(() => ack({ ok: false, error: "Course introuvable" }));

  expect(screen.getByRole("alert").textContent).toBe("Course introuvable");
});

test("Should_Disconnect_When_Unmounted", () => {
  const { unmount } = render(<LobbyRoom code="K7P3XM" hostId="u1" />);

  unmount();

  expect(socket.disconnect).toHaveBeenCalled();
});
