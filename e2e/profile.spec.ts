import { expect, test } from "@playwright/test";

test("Should_ShowYouBadgeOnlyToOwner_When_VisitingAProfile", async ({ page }) => {
  const username = `e2e_${Date.now().toString(36)}`;
  await page.goto("/signup");
  await page.getByLabel("Nom d'utilisateur").fill(username);
  await page.getByLabel("Mot de passe").fill("motdepasse123");
  await page.getByRole("button", { name: "Créer le compte" }).click();

  await page.getByRole("navigation").getByRole("link", { name: "Mon profil" }).click();
  await expect(page).toHaveURL(`/profile/${username}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(username);
  await expect(page.getByText("Toi", { exact: true })).toBeVisible();
  await expect(page.getByText("Aucune course pour l’instant.")).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.goto(`/profile/${username}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(username);
  await expect(page.getByText("Toi", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Mon profil" })).toHaveCount(0);
});

test("Should_HaveNoProfileLink_When_PlayingAsGuest", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Jouer en invité" }).click();
  const name = (await page.locator("strong", { hasText: /^Invité-\d{6}$/ }).textContent())!;

  await expect(page.getByRole("link", { name: "Mon profil" })).toHaveCount(0);
  const response = await page.goto(`/profile/${name}`);
  expect(response?.status()).toBe(404);
});

test("Should_Show404_When_UserIsUnknown", async ({ page }) => {
  const response = await page.goto("/profile/personne_inconnue_xyz");

  expect(response?.status()).toBe(404);
});
