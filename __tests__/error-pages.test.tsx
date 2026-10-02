import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import NotFound from "../app/not-found";
import ErrorPage from "../app/error";
import GlobalError from "../app/global-error";
import en from "../messages/en.json";
import fr from "../messages/fr.json";

vi.mock("next/font/google", () => {
  const font = () => ({ variable: "" });
  return { Geist: font, JetBrains_Mono: font, Russo_One: font };
});

// jsdom n'a pas matchMedia : le système demande le thème clair par défaut.
function stubSystemTheme(dark: boolean) {
  vi.stubGlobal("matchMedia", () => ({ matches: dark }));
}

beforeEach(() => {
  cleanup();
  stubSystemTheme(false);
});

afterEach(() => {
  document.cookie = "NEXT_LOCALE=; max-age=0";
  localStorage.clear();
  vi.unstubAllGlobals();
});

function renderError(retry = vi.fn(), locale: "fr" | "en" = "fr") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      <ErrorPage error={new Error("boom")} retry={retry} />
    </NextIntlClientProvider>,
  );
}

test("Should_ShowNotFoundHeading_When_NotFoundPageIsRendered", async () => {
  render(await NotFound());

  expect(screen.getByRole("heading", { level: 1, name: "Hors du terrain." })).toBeDefined();
});

test("Should_LinkBackHome_When_NotFoundPageIsRendered", async () => {
  render(await NotFound());

  expect(screen.getByRole("link", { name: /Retour à l’accueil/ }).getAttribute("href")).toBe("/");
});

test("Should_ShowServerErrorHeading_When_ErrorPageIsRendered", () => {
  renderError();

  expect(screen.getByRole("heading", { level: 1, name: "Panne de moteur." })).toBeDefined();
});

test("Should_CallRetry_When_TryAgainIsClicked", () => {
  const retry = vi.fn();
  renderError(retry);

  fireEvent.click(screen.getByRole("button", { name: /Réessayer/ }));

  expect(retry).toHaveBeenCalledOnce();
});

test("Should_NotShowErrorMessage_When_ErrorPageIsRendered", () => {
  renderError();

  expect(screen.queryByText("boom")).toBeNull();
});

test("Should_ShowEnglishTexts_When_LocaleIsEnglish", () => {
  renderError(vi.fn(), "en");

  expect(screen.getByRole("heading", { level: 1, name: "Engine failure." })).toBeDefined();
  expect(screen.getByRole("button", { name: /Try again/ })).toBeDefined();
  expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe("/");
});

// React place lui-même le <html> et le <body> de global-error sur ceux du document.
function renderGlobalError(retry = vi.fn()) {
  return render(<GlobalError error={new Error("boom")} retry={retry} />);
}

test("Should_ShowServerErrorPage_When_RootLayoutFails", () => {
  document.cookie = "NEXT_LOCALE=fr";
  const retry = vi.fn();
  renderGlobalError(retry);

  expect(screen.getByRole("heading", { level: 1, name: "Panne de moteur." })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: /Réessayer/ }));
  expect(retry).toHaveBeenCalledOnce();
});

test("Should_UseBrowserLanguage_When_NoLocaleCookie", () => {
  vi.stubGlobal("navigator", { languages: ["en-US", "fr"] });

  renderGlobalError();

  expect(screen.getByRole("heading", { level: 1, name: "Engine failure." })).toBeDefined();
});

test("Should_UseEnglish_When_LocaleCookieIsEnglish", () => {
  document.cookie = "NEXT_LOCALE=en";
  vi.stubGlobal("navigator", { languages: ["fr-CA"] });

  renderGlobalError();

  expect(screen.getByRole("heading", { level: 1, name: "Engine failure." })).toBeDefined();
  expect(document.documentElement.lang).toBe("en");
});

test("Should_UseDarkTheme_When_DarkThemeWasChosen", () => {
  localStorage.setItem("theme", "dark");

  renderGlobalError();

  expect(document.documentElement.classList.contains("dark")).toBe(true);
});

test("Should_UseLightTheme_When_LightThemeWasChosen", () => {
  localStorage.setItem("theme", "light");

  renderGlobalError();

  expect(document.documentElement.classList.contains("dark")).toBe(false);
});

test("Should_FollowSystemTheme_When_NoThemeWasChosen", () => {
  stubSystemTheme(true);

  renderGlobalError();

  expect(document.documentElement.classList.contains("dark")).toBe(true);
});
