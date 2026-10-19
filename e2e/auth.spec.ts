import { expect, test, type Page } from "@playwright/test";

test("Should_StayLoggedIn_When_SigningUpThenLoggingOutAndBackIn", async ({
  page,
}) => {
  const username = `e2e_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  await page.goto("/signup");
  await page.getByLabel("Nom d'utilisateur").fill(username);
  await page.getByLabel("Mot de passe").fill("motdepasse123");
  await page.getByRole("button", { name: "Créer le compte" }).click();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Mon profil" })).toHaveAttribute("href", `/profile/${username}`);

  await page.reload();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Mon profil" })).toHaveAttribute("href", `/profile/${username}`);

  await page.getByRole("navigation").getByRole("link", { name: "Mon profil" }).click();
  await expect(page).toHaveURL(`/profile/${username}`);
  // Un préchargement encore en cours remettrait le cookie de session après la déconnexion.
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.getByRole("link", { name: "Se connecter" }).click();
  await page.getByLabel("Nom d'utilisateur").fill(username);
  await page.getByLabel("Mot de passe").fill("motdepasse123");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Mon profil" })).toHaveAttribute("href", `/profile/${username}`);
});

test("Should_ShowError_When_PasswordIsWrong", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Nom d'utilisateur").fill("personne_inconnue");
  await page.getByLabel("Mot de passe").fill("motdepasse123");
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

async function logInFreshAccount(page: Page, remember: boolean) {
  const username = `e2e_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await page.goto("/signup");
  await page.getByLabel("Nom d'utilisateur").fill(username);
  await page.getByLabel("Mot de passe").fill("motdepasse123");
  await page.getByRole("button", { name: "Créer le compte" }).click();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Mon profil" })).toBeVisible();
  await page.context().clearCookies();

  await page.goto("/login");
  await page.getByLabel("Nom d'utilisateur").fill(username);
  await page.getByLabel("Mot de passe").fill("motdepasse123");
  await page.getByLabel("Se souvenir de moi").setChecked(remember);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Mon profil" })).toBeVisible();
  // Une visite passe par le proxy, qui prolonge le cookie d'une session retenue.
  await page.reload();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Mon profil" })).toBeVisible();
}

test("Should_KeepSessionThirtyDays_When_RememberMeIsChecked", async ({ page, context }) => {
  await logInFreshAccount(page, true);

  const session = (await context.cookies()).find((c) => c.name === "session");
  expect(session!.expires * 1000 - Date.now()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
});

test("Should_EndSessionWithBrowser_When_RememberMeIsUnchecked", async ({ page, context }) => {
  await logInFreshAccount(page, false);

  // -1 : cookie de session du navigateur, supprimé à sa fermeture.
  const session = (await context.cookies()).find((c) => c.name === "session");
  expect(session!.expires).toBe(-1);
});
