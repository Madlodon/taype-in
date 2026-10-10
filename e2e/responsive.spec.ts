import { expect, test, type Browser, type Page } from "@playwright/test";

// Roule sur ordinateur, téléphone et tablette (projets de playwright.config.ts).

// browser.newContext() ne reprend pas l'appareil du projet : on le lui passe.
async function newDevicePage(browser: Browser): Promise<Page> {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL, locale } =
    test.info().project.use;
  const context = await browser.newContext({
    viewport,
    userAgent,
    deviceScaleFactor,
    isMobile,
    hasTouch,
    baseURL,
    locale,
  });
  return context.newPage();
}

async function newGuest(browser: Browser): Promise<{ page: Page; name: string }> {
  const page = await newDevicePage(browser);
  await page.goto("/");
  await page.getByRole("button", { name: "Jouer en invité" }).click();
  const name = (await page.locator("strong", { hasText: /^Invité-\d{6}$/ }).textContent())!;
  return { page, name };
}

// Seuls les inscrits créent une course (AUTH-03) : l'hôte a un compte.
async function newHost(browser: Browser): Promise<{ page: Page; name: string }> {
  const page = await newDevicePage(browser);
  const name = `host_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await page.goto("/signup");
  await page.getByLabel("Nom d'utilisateur").fill(name);
  await page.getByLabel("Mot de passe").fill("motdepasse123");
  await page.getByRole("button", { name: "Créer le compte" }).click();
  await expect(page.getByText(`Connecté en tant que ${name}`)).toBeVisible();
  return { page, name };
}

// Sur mobile, window.innerWidth s'élargit avec le contenu : on compare à la largeur de l'appareil.
async function expectNoHorizontalScroll(page: Page) {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(page.viewportSize()!.width);
}

test("Should_FitEveryPage_When_Visiting", async ({ page }) => {
  for (const route of ["/", "/login", "/signup", "/race", "/page-inconnue", "/invite/inconnu"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole("button", { name: "Sombre" }).click();
    await expectNoHorizontalScroll(page);
    await page.getByRole("button", { name: "Clair" }).click();
  }
  // Créer une course demande un compte (AUTH-03).
  await page.goto("/signup");
  await page.getByLabel("Nom d'utilisateur").fill(`e2e_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  await page.getByLabel("Mot de passe").fill("motdepasse123");
  await page.getByRole("button", { name: "Créer le compte" }).click();
  await page.getByRole("link", { name: "Démarrer une course" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole("link", { name: "Créer une course", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.goto("/garage");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("Should_FitProfilePage_When_Visiting", async ({ page }) => {
  const username = `e2e_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await page.goto("/signup");
  await page.getByLabel("Nom d'utilisateur").fill(username);
  await page.getByLabel("Mot de passe").fill("motdepasse123");
  await page.getByRole("button", { name: "Créer le compte" }).click();
  await page.getByRole("navigation").getByRole("link", { name: "Mon profil" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(username);
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Sombre" }).click();
  await expectNoHorizontalScroll(page);
});

test("Should_ReachEveryPage_When_UsingTheNavigation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Jouer en invité" }).click();
  const nav = page.getByRole("navigation");
  for (const [label, url] of [
    ["Trouver une course", "/lobbies"],
    ["Entraînement", "/race"],
    ["Garage", "/garage"],
    ["Accueil", "/"],
  ]) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(url);
  }
});

test("Should_TypeAndSeeRanking_When_RacingOnThisScreen", async ({ browser }) => {
  const host = await newHost(browser);
  await host.page.getByRole("link", { name: "Démarrer une course" }).click();
  await host.page.getByRole("link", { name: "Créer une course" }).click();
  await host.page.getByLabel(/Non répertoriée/).check();
  await host.page.getByRole("button", { name: "Créer la course" }).click();
  await expect(host.page.getByRole("heading", { name: "Salle d'attente" })).toBeVisible();
  const player = await newGuest(browser);
  await player.page.goto(host.page.url());
  await expect(player.page.getByRole("list", { name: "Participants" })).toBeVisible();
  await expectNoHorizontalScroll(host.page);

  await host.page.getByRole("button", { name: "Lancer et courir" }).click();
  const input = player.page.getByRole("textbox", { name: "Tape le texte" });
  await expect(input).toBeFocused({ timeout: 8000 });
  await expect(input).toBeInViewport();
  const text = (await player.page.locator(".typing-text").textContent())!;
  await player.page.keyboard.type(text.slice(0, 10));

  const ranking = host.page.getByRole("list", { name: "Classement" }).getByRole("listitem");
  await expect(ranking.first()).toHaveText(new RegExp(`^${player.name}\\d+ MPM · \\d+ %$`));
  await expectNoHorizontalScroll(host.page);
  await expectNoHorizontalScroll(player.page);
});

test("Should_FitResults_When_RaceEnds", async ({ browser }) => {
  const host = await newHost(browser);
  await host.page.getByRole("link", { name: "Démarrer une course" }).click();
  await host.page.getByRole("link", { name: "Créer une course" }).click();
  await host.page.getByLabel(/Non répertoriée/).check();
  await host.page.getByRole("button", { name: "Créer la course" }).click();
  await expect(host.page.getByRole("heading", { name: "Salle d'attente" })).toBeVisible();
  const player = await newGuest(browser);
  await player.page.goto(host.page.url());
  await expect(player.page.getByRole("list", { name: "Participants" })).toBeVisible();
  await host.page.getByRole("button", { name: "Lancer et courir" }).click();
  const input = host.page.getByRole("textbox", { name: "Tape le texte" });
  await expect(input).toBeFocused({ timeout: 8000 });
  const text = (await host.page.locator(".typing-text").textContent())!;
  await host.page.keyboard.type(text.slice(0, 10));

  // Les deux abandonnent : la course finit tout de suite et les résultats s'affichent.
  for (const { page } of [player, host]) {
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Abandonner" }).click();
  }

  for (const { page } of [host, player]) {
    await expect(page.getByRole("heading", { name: "Résultats" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  }
});
