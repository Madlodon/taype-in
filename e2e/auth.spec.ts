import { expect, test, type Browser, type Page } from "@playwright/test";

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

// Une adresse à part : les autres tests ne sont pas bloqués (#271).
test.describe("Many wrong passwords", () => {
  test.use({ extraHTTPHeaders: { "x-forwarded-for": `10.99.${Math.floor(Math.random() * 256)}.1` } });

  test("Should_ShowTooManyAttempts_When_TenLogInsFailed", async ({ page }) => {
    await page.goto("/login");
    for (let attempt = 0; attempt < 10; attempt++) {
      await page.getByLabel("Nom d'utilisateur").fill("personne_inconnue");
      await page.getByLabel("Mot de passe").fill(`mauvais-${attempt}-mdp`);
      // L'erreur reste affichée d'un essai à l'autre : on attend la réponse de chaque envoi.
      const answered = page.waitForResponse((response) => response.request().method() === "POST");
      await page.getByRole("button", { name: "Se connecter" }).click();
      await answered;
    }

    await page.getByLabel("Mot de passe").fill("motdepasse123");
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Trop d'essais" })).toBeVisible();
  });
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

async function logInFreshAccount(browser: Browser, page: Page, remember: boolean) {
  const username = `e2e_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  // Inscription dans un autre navigateur : une requête encore en cours y remettrait le cookie de 30 jours.
  const signupContext = await browser.newContext();
  const signupPage = await signupContext.newPage();
  await signupPage.goto("/signup");
  await signupPage.getByLabel("Nom d'utilisateur").fill(username);
  await signupPage.getByLabel("Mot de passe").fill("motdepasse123");
  await signupPage.getByRole("button", { name: "Créer le compte" }).click();
  await expect(signupPage.getByRole("navigation").getByRole("link", { name: "Mon profil" })).toBeVisible();
  await signupContext.close();

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

test("Should_KeepSessionThirtyDays_When_RememberMeIsChecked", async ({ browser, page, context }) => {
  await logInFreshAccount(browser, page, true);

  const session = (await context.cookies()).find((c) => c.name === "session");
  expect(session!.expires * 1000 - Date.now()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
});

test("Should_EndSessionWithBrowser_When_RememberMeIsUnchecked", async ({ browser, page, context }) => {
  await logInFreshAccount(browser, page, false);

  // -1 : cookie de session du navigateur, supprimé à sa fermeture.
  const session = (await context.cookies()).find((c) => c.name === "session");
  expect(session!.expires).toBe(-1);
});
