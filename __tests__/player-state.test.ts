import { describe, expect, test } from "vitest";
import { nextPlayerState, type PlayerEvent, type PlayerState } from "../lib/player-state";

describe("nextPlayerState", () => {
  test.each<[PlayerState, PlayerEvent, PlayerState]>([
    ["connected", "disconnect", "disconnected"],
    ["connected", "finish", "finished"],
    ["connected", "abandon", "abandoned"],
    ["disconnected", "reconnect", "connected"],
  ])("Should_Transition_When_%sReceives%s (→ %s)", (state, event, expected) => {
    expect(nextPlayerState(state, event)).toBe(expected);
  });

  test.each<[PlayerState, PlayerEvent]>([
    ["connected", "reconnect"],
    ["disconnected", "disconnect"],
    ["disconnected", "finish"],
    ["disconnected", "abandon"],
  ])("Should_Throw_When_%sReceives%s", (state, event) => {
    expect(() => nextPlayerState(state, event)).toThrow();
  });

  test.each<PlayerState>(["finished", "abandoned"])(
    "Should_Throw_When_PlayerIs%s",
    (state) => {
      const events: PlayerEvent[] = ["disconnect", "reconnect", "finish", "abandon"];
      for (const event of events) {
        expect(() => nextPlayerState(state, event)).toThrow();
      }
    },
  );
});
