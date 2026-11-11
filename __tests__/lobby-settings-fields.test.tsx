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
  visibility: "unlisted",
  textLanguage: "en",
  textLength: 100,
  textComplexity: "medium",
  textPunctuation: true,
  textNumbers: true,
  textCapitals: true,
  textAccents: true,
  textType: "sentences",
  textTargets: [],
  textLetters: "",
  customText: null,
  errorMode: "blocking",
  timeLimitSeconds: 90,
  capacity: 8,
  bonusesEnabled: false,
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

const checked = (label: string | RegExp) => (screen.getByLabelText(label) as HTMLInputElement).checked;
const value = (label: string | RegExp) => (screen.getByLabelText(label) as HTMLInputElement).value;

test("Should_CheckSentencesWithoutTargets_When_CreatingLobby", () => {
  fields();

  expect(checked(/^Bank text/)).toBe(true);
  expect(checked("Digits")).toBe(false);
  expect(value("Your text")).toBe("");
});

test("Should_ShowLobbyTextOptions_When_EditingSettings", () => {
  fields({
    ...settings,
    textType: "words",
    textTargets: ["comma", "digits"],
    textLetters: "qz",
  });

  expect(checked(/^Scrambled words/)).toBe(true);
  expect(checked("Commas")).toBe(true);
  expect(checked("Digits")).toBe(true);
  expect(checked("Accents")).toBe(false);
  expect(value("Letters to practise")).toBe("qz");
});

test("Should_CheckOwnTextWithLobbyText_When_LobbyHasCustomText", () => {
  fields({ ...settings, customText: "Mon texte." });

  expect(checked(/^My own text/)).toBe(true);
  expect(checked(/^Bank text/)).toBe(false);
  expect(value("Your text")).toBe("Mon texte.");
});

test("Should_DescribeLettersField_With_Hint", () => {
  fields();

  const hint = screen.getByLabelText("Letters to practise").getAttribute("aria-describedby");

  expect(document.getElementById(hint!)?.textContent).toMatch(/^E\.g\. qzx/);
});

test("Should_TagEachTextOptionWithItsSources", () => {
  fields();
  const sources = (label: string) =>
    screen.getByText(label, { selector: "legend" }).closest("[data-for]")?.getAttribute("data-for");

  expect(sources("Text language")).toBe("sentences words");
  expect(sources("Complexity")).toBe("sentences");
  expect(sources("Characters to practise")).toBe("words");
  expect(screen.getByLabelText("Your text").closest("[data-for]")?.getAttribute("data-for")).toBe("custom");
});

test("Should_SelectMediumAndTickEveryOption_When_CreatingLobby", () => {
  fields();

  expect((screen.getByRole("radio", { name: /^Medium/ }) as HTMLInputElement).checked).toBe(true);
  expect(["Punctuation", "Numbers", "Capital letters", "Accents (French text)"].map(checked)).toEqual([
    true,
    true,
    true,
    true,
  ]);
});

test("Should_ShowLobbyComplexityAndOptions_When_EditingSettings", () => {
  fields({ ...settings, textComplexity: "hard", textNumbers: false, textAccents: false });

  expect((screen.getByRole("radio", { name: /^Hard/ }) as HTMLInputElement).checked).toBe(true);
  expect(["Punctuation", "Numbers", "Capital letters", "Accents (French text)"].map(checked)).toEqual([
    true,
    false,
    true,
    false,
  ]);
});

function bonuses(settings?: LobbySettings) {
  fields(settings);
  return screen.getByRole("checkbox", { name: /Turn on bonuses/ }) as HTMLInputElement;
}

test("Should_LeaveBonusesOff_When_CreatingLobby", () => {
  expect(bonuses().checked).toBe(false);
});

test("Should_CheckBonuses_When_LobbyHasThem", () => {
  expect(bonuses({ ...settings, bonusesEnabled: true }).checked).toBe(true);
});

const visibility = () => (screen.getByRole("radio", { checked: true, name: /^(Public|Unlisted|Private):/ }) as HTMLInputElement).value;

test("Should_SelectPublic_When_CreatingLobby", () => {
  fields();

  expect(visibility()).toBe("public");
});

test("Should_SelectLobbyVisibility_When_EditingSettings", () => {
  fields({ ...settings, visibility: "private" });

  expect(visibility()).toBe("private");
});

function radio(name: string | RegExp) {
  return screen.getByRole("radio", { name }) as HTMLInputElement;
}

test("Should_OfferTwentyFiveWordsAndCustom_When_CreatingLobby", () => {
  fields();

  const lengths = screen.getAllByRole("radio").filter((input) => input.getAttribute("name") === "textLength");
  expect(lengths.map((input) => input.getAttribute("value"))).toEqual(["25", "50", "100", "200", "custom"]);
  expect(radio("100 words").checked).toBe(true);
  expect(radio(/^Custom/).checked).toBe(false);
});

test("Should_CheckCustomWithLobbyLength_When_LengthIsNotAPreset", () => {
  fields({ ...settings, textLength: 37 });

  expect(radio(/^Custom/).checked).toBe(true);
  expect((screen.getByLabelText("Number of words (1 to 250)") as HTMLInputElement).value).toBe("37");
});

test("Should_CheckPresetLength_When_LobbyLengthIsAPreset", () => {
  fields({ ...settings, textLength: 25 });

  expect(radio("25 words").checked).toBe(true);
  expect(radio(/^Custom/).checked).toBe(false);
});
