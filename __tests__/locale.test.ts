import { expect, test } from "vitest";
import { resolveLocale } from "../i18n/locale";

test("Should_UseCookie_When_CookieIsAKnownLocale", () => {
  expect(resolveLocale("en", "fr-CA,fr")).toBe("en");
});

test("Should_UseBrowserLanguage_When_NoCookie", () => {
  expect(resolveLocale(undefined, "en-US,en;q=0.9")).toBe("en");
});

test("Should_SkipUnknownLanguages_When_ReadingBrowserLanguages", () => {
  expect(resolveLocale(undefined, "es-ES,es;q=0.9,en;q=0.8,fr;q=0.7")).toBe("en");
});

test("Should_IgnoreCookie_When_CookieIsNotAKnownLocale", () => {
  expect(resolveLocale("de", "en")).toBe("en");
});

test("Should_FallBackToFrench_When_NoKnownLanguage", () => {
  expect(resolveLocale(undefined, "de-DE,es")).toBe("fr");
});

test("Should_FallBackToFrench_When_NoCookieAndNoHeader", () => {
  expect(resolveLocale(undefined, null)).toBe("fr");
});
