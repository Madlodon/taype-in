import { expect, test, type Browser, type Page } from "@playwright/test";

// Chaque joueur a son propre contexte, donc sa propre session invité.
async function newGuest(browser: Browser): Promise<{ page: Page; name: string }> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Jouer en invité" }).click();
  const name = (await page.locator("strong", { hasText: /^Invité-\d{6}$/ }).textContent())!;
  return { page, name };
}

async function createRace(page: Page, visibility: RegExp): Promise<string> {
  await page.getByRole("link", { name: "Démarrer une course" }).click();
  await page.getByRole("link", { name: "Créer une course" }).click();
  await page.getByLabel(visibility).check();
  await page.getByRole("button", { name: "Créer la course" }).click();
  await expect(page).toHaveURL(/\/lobbies\/[A-Z2-9]{6}$/);
  return page.url().split("/").pop()!;
}

function participants(page: Page) {
  return page.getByRole("list", { name: "Participants" }).getByRole("listitem");
}

test("Should_SeeEachOtherInRealTime_When_GuestJoinsUnlistedRaceByCode", async ({
  browser,
}) => {
  const host = await newGuest(browser);
  const code = await createRace(host.page, /Non répertoriée/);
  await expect(participants(host.page)).toHaveText([`${host.name} (hôte)`]);

  const player = await newGuest(browser);
  await player.page.getByRole("link", { name: "Démarrer une course" }).click();
  await expect(player.page.getByText(`Course de ${host.name}`)).toHaveCount(0);
  await player.page.getByLabel("Code de la course").fill(code.toLowerCase());
  await player.page.getByRole("button", { name: "Rejoindre" }).click();

  const expected = [`${host.name} (hôte)`, player.name];
  await expect(participants(player.page)).toHaveText(expected);
  await expect(participants(host.page)).toHaveText(expected);

  await player.page.close();
  await expect(participants(host.page)).toHaveText([`${host.name} (hôte)`]);
});

test("Should_JoinFromList_When_RaceIsPublic", async ({ browser }) => {
  const host = await newGuest(browser);
  await createRace(host.page, /Publique/);
  await expect(participants(host.page)).toHaveCount(1);

  const player = await newGuest(browser);
  await player.page.getByRole("link", { name: "Démarrer une course" }).click();
  await player.page.getByRole("link", { name: `Course de ${host.name}` }).click();

  await expect(participants(host.page)).toHaveText([`${host.name} (hôte)`, player.name]);
});

test("Should_ShowError_When_CodeDoesNotExist", async ({ browser }) => {
  const { page } = await newGuest(browser);
  await page.goto("/lobbies");
  await page.getByLabel("Code de la course").fill("ZZZZZZ");
  await page.getByRole("button", { name: "Rejoindre" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "code" })).toHaveText(
    "Aucune course ouverte avec ce code.",
  );
});

test("Should_RedirectHome_When_NotLoggedIn", async ({ page }) => {
  await page.goto("/lobbies");

  await expect(page).toHaveURL("/");
});
