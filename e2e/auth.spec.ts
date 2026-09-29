import { expect, test } from "@playwright/test";

test("Should_StayLoggedIn_When_SigningUpThenLoggingOutAndBackIn", async ({
  page,
}) => {
  const username = `e2e_${Date.now().toString(36)}`;

  await page.goto("/signup");
  await page.getByLabel("Nom d'utilisateur").fill(username);
  await page.getByLabel("Mot de passe").fill("motdepasse");
  await page.getByRole("button", { name: "Créer le compte" }).click();
  await expect(page.getByText(`Connecté en tant que ${username}`)).toBeVisible();

  await page.reload();
  await expect(page.getByText(`Connecté en tant que ${username}`)).toBeVisible();

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.getByRole("link", { name: "Se connecter" }).click();
  await page.getByLabel("Nom d'utilisateur").fill(username);
  await page.getByLabel("Mot de passe").fill("motdepasse");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText(`Connecté en tant que ${username}`)).toBeVisible();
});

test("Should_ShowError_When_PasswordIsWrong", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Nom d'utilisateur").fill("personne_inconnue");
  await page.getByLabel("Mot de passe").fill("motdepasse");
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "incorrect" }),
  ).toHaveText("Nom d'utilisateur ou mot de passe incorrect.");
});

test("Should_BeLoggedInAsGuest_When_PlayingAsGuest", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Jouer en invité" }).click();

  await expect(page.getByText(/Invité-\d{6} \(invité\)/)).toBeVisible();
});

test("Should_SetHttpOnlySessionCookie_When_LoggedIn", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Jouer en invité" }).click();
  await expect(page.getByText("(invité)")).toBeVisible();

  const session = (await context.cookies()).find((c) => c.name === "session");
  expect(session).toMatchObject({ httpOnly: true, sameSite: "Lax" });
  expect(session!.expires * 1000 - Date.now()).toBeGreaterThan(
    29 * 24 * 60 * 60 * 1000,
  );
});
