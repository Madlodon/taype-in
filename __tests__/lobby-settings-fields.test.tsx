import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { LobbySettingsFields } from "../components/lobby-settings-fields";
import type { LobbySettings } from "../lib/lobbies";
import en from "../messages/en.json";

function fields(settings?: LobbySettings) {
  render(<NextIntlClientProvider locale="en" messages={en}>
    <LobbySettingsFields settings={settings} locale="en" />
  </NextIntlClientProvider>);
  return screen.getByLabelText("Duration") as HTMLSelectElement;
}

const settings: LobbySettings = {
  textLanguage: "en",
  textLength: 100,
  errorMode: "blocking",
  timeLimitSeconds: 90,
  capacity: 8,
};

afterEach(cleanup);

test("Should_OfferEvery30Seconds_From30SecondsTo10Minutes", () => {
  const options = within(fields()).getAllByRole("option");

  expect(options.map((option) => option.getAttribute("value"))).toEqual(
    Array.from({ length: 20 }, (_, i) => String((i + 1) * 30)),
  );
  expect(options.slice(0, 4).map((option) => option.textContent)).toEqual([
    "30 s",
    "1 min",
    "1 min 30",
    "2 min",
  ]);
  expect(options.at(-1)!.textContent).toBe("10 min");
});

test("Should_SelectFiveMinutes_When_CreatingLobby", () => {
  expect(fields().value).toBe("300");
});

test("Should_SelectLobbyTimer_When_EditingSettings", () => {
  expect(fields(settings).value).toBe("90");
});

test("Should_SelectFiveMinutes_When_LobbyTimerIsOutOfRange", () => {
  expect(fields({ ...settings, timeLimitSeconds: 86400 }).value).toBe("300");
});

function capacity(settings?: LobbySettings) {
  fields(settings);
  return screen.getByLabelText("Maximum capacity") as HTMLSelectElement;
}

test("Should_OfferCapacities_From2To30", () => {
  const options = within(capacity()).getAllByRole("option");

  expect(options.map((option) => option.getAttribute("value"))).toEqual(
    Array.from({ length: 29 }, (_, i) => String(i + 2)),
  );
  expect(options[0].textContent).toBe("2 participants");
});

test("Should_SelectThirty_When_CreatingLobby", () => {
  expect(capacity().value).toBe("30");
});

test("Should_SelectLobbyCapacity_When_EditingSettings", () => {
  expect(capacity(settings).value).toBe("8");
});
