import { beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import NotFound from "../app/not-found";
import ErrorPage from "../app/error";
import en from "../messages/en.json";
import fr from "../messages/fr.json";

beforeEach(() => {
  cleanup();
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
