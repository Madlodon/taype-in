import { describe, expect, test } from "vitest";
import { nextLobbyState, type LobbyEvent, type LobbyState } from "../lib/lobby-state";

describe("nextLobbyState", () => {
  test.each<[LobbyState, LobbyEvent, LobbyState]>([
    ["waiting", "start", "countdown"],
    ["waiting", "close", "closed"],
    ["countdown", "countdownEnd", "racing"],
    ["racing", "end", "finished"],
    ["racing", "stop", "finished"],
    ["finished", "restart", "waiting"],
    ["finished", "close", "closed"],
  ])("Should_Transition_When_%sReceives%s (→ %s)", (state, event, expected) => {
    expect(nextLobbyState(state, event)).toBe(expected);
  });

  test.each<[LobbyState, LobbyEvent]>([
    ["waiting", "end"],
    ["waiting", "restart"],
    ["countdown", "start"],
    ["countdown", "stop"],
    ["countdown", "close"],
    ["racing", "start"],
    ["racing", "close"],
    ["finished", "start"],
    ["finished", "end"],
  ])("Should_Throw_When_%sReceives%s", (state, event) => {
    expect(() => nextLobbyState(state, event)).toThrow();
  });

  test("Should_Throw_When_LobbyIsClosed", () => {
    const events: LobbyEvent[] = ["start", "countdownEnd", "end", "stop", "restart", "close"];
    for (const event of events) {
      expect(() => nextLobbyState("closed", event)).toThrow();
    }
  });
});
