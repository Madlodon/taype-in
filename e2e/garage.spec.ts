import { expect, test } from "@playwright/test";

test("Should_KeepChoice_When_RegisteredUserSavesGarage", async ({ page }) => {
  // Préfixe propre à ce fichier : auth.spec.ts crée aussi des comptes en parallèle.
  const username = `garage_${Date.now().toString(36)}`;
  await page.goto("/signup");
  await page.getByLabel("Nom d'utilisateur").fill(username);
  await page.getByLabel("Mot de passe").fill("motdepasse123");
  await page.getByRole("button", { name: "Créer le compte" }).click();
  await expect(page.getByText(`Connecté en tant que ${username}`)).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: "Garage" }).click();
  await expect(page).toHaveURL("/garage");
  await expect(page.getByRole("radio", { name: "Octane", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Standard", exact: true })).toBeChecked();
  await page.getByRole("radio", { name: "Fennec", exact: true }).check();
  await page.getByRole("radio", { name: "Flammes", exact: true }).check();
  await page.getByRole("radio", { name: "Cône orange", exact: true }).check();
  await page.getByRole("radio", { name: "Ballon de plage", exact: true }).check();
  await page.getByRole("button", { name: "Enregistrer mon garage" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Garage enregistré." })).toBeVisible();

  await page.reload();
  for (const item of ["Fennec", "Flammes", "Cône orange", "Ballon de plage"]) {
    await expect(page.getByRole("radio", { name: item, exact: true })).toBeChecked();
  }
  await expect(page.getByRole("img", { name: "Fennec avec le boost Flammes, chapeau : Cône orange, ballon : Ballon de plage" })).toBeVisible();

  for (const hat of ["Casquette Alpha", "Haut-de-forme", "Chapeau de pirate", "Chapeau de sorcier"]) {
    await page.getByRole("radio", { name: hat, exact: true }).check();
    await page.getByRole("button", { name: "Enregistrer mon garage" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Garage enregistré." })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("radio", { name: hat, exact: true })).toBeChecked();
    await expect(page.getByRole("img", { name: `Fennec avec le boost Flammes, chapeau : ${hat}, ballon : Ballon de plage` })).toBeVisible();
  }
});

test("Should_InviteToSignUp_When_GuestOpensGarage", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Jouer en invité" }).click();
  await expect(page.getByText(/Invité-\d{6} \(invité\)/)).toBeVisible();
  await page.getByRole("navigation").getByRole("link", { name: "Garage" }).click();

  await page.getByRole("radio", { name: "Cône orange", exact: true }).check();
  await expect(page.getByRole("img", { name: /chapeau : Cône orange/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enregistrer mon garage" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Créer un compte" })).toBeVisible();
});

test("Should_AskToLogIn_When_NobodyIsLoggedIn", async ({ page }) => {
  await page.goto("/garage");
  await expect(page).toHaveURL("/login?next=/garage");
  await expect(page.getByRole("status")).toHaveText("Connecte-toi ou joue en invité pour continuer.");
});

test("Should_ReturnToGarage_When_PlayingAsGuestFromLogIn", async ({ page }) => {
  await page.goto("/garage");
  await page.getByRole("button", { name: "Jouer en invité" }).click();
  await expect(page).toHaveURL("/garage");
});
