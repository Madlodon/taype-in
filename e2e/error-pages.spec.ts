import { expect, test } from "@playwright/test";

test("Should_Show404Page_When_UrlIsUnknown", async ({ page }) => {
  const response = await page.goto("/cette-page-nexiste-pas");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Hors du terrain." })).toBeVisible();
  await page.getByRole("link", { name: /Retour à l’accueil/ }).click();
  await expect(page).toHaveURL("/");
});

test("Should_Show404Page_When_RaceCodeDoesNotExist", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Jouer en invité" }).click();
  await expect(page.getByRole("link", { name: "Démarrer une course" })).toBeVisible();

  await page.goto("/lobbies/ZZZZZZ");

  await expect(page.getByRole("heading", { level: 1, name: "Hors du terrain." })).toBeVisible();
});
