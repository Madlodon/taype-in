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

test("Should_ShowCodeOnlyToHost_When_RaceIsUnlisted", async ({ browser }) => {
  const host = await newGuest(browser);
  const code = await createRace(host.page, /Non répertoriée/);
  await expect(host.page.getByText("Code de la course :")).toBeVisible();

  const player = await newGuest(browser);
  await player.page.goto(`/lobbies/${code}`);

  await expect(participants(player.page)).toHaveCount(2);
  await expect(player.page.getByText("Code de la course :")).toHaveCount(0);
});

async function generateInvites(page: Page, count: number): Promise<string[]> {
  await page.getByLabel("Nombre de liens").fill(String(count));
  await page.getByRole("button", { name: "Générer les liens" }).click();
  const links = page.getByLabel("Liens non utilisés (un par ligne)");
  await expect(links).toBeVisible();
  return (await links.inputValue()).split("\n");
}

test("Should_JoinPrivateRaceOnlyByInviteLink_When_HostGeneratesLinks", async ({
  browser,
}) => {
  const host = await newGuest(browser);
  const code = await createRace(host.page, /Privée/);
  await expect(host.page.getByText("Code de la course :")).toHaveCount(0);

  const links = await generateInvites(host.page, 3);
  expect(links).toHaveLength(3);
  expect(new Set(links).size).toBe(3);
  await expect(host.page.getByText("0 sur 3 liens utilisés")).toBeVisible();

  // Ni dans la liste, ni par le code, ni par l'adresse directe.
  const outsider = await newGuest(browser);
  await outsider.page.goto("/lobbies");
  await expect(outsider.page.getByText(`Course de ${host.name}`)).toHaveCount(0);
  await outsider.page.getByLabel("Code de la course").fill(code);
  await outsider.page.getByRole("button", { name: "Rejoindre" }).click();
  await expect(outsider.page.getByRole("alert").filter({ hasText: "code" })).toHaveText(
    "Aucune course ouverte avec ce code.",
  );
  expect((await outsider.page.goto(`/lobbies/${code}`))?.status()).toBe(404);

  const student = await newGuest(browser);
  await student.page.goto(links[0]);
  await student.page.getByRole("button", { name: "Rejoindre la course" }).click();
  await expect(student.page).toHaveURL(`/lobbies/${code}`);
  const expected = [`${host.name} (hôte)`, student.name];
  await expect(participants(student.page)).toHaveText(expected);
  await expect(participants(host.page)).toHaveText(expected);

  // Le lien sert une seule fois : un autre élève ne peut plus l'utiliser.
  await outsider.page.goto(links[0]);
  await expect(outsider.page.getByRole("heading", { name: "Lien non disponible" })).toBeVisible();

  await host.page.reload();
  await expect(host.page.getByText("1 sur 3 liens utilisés")).toBeVisible();
  expect(
    (await host.page.getByLabel("Liens non utilisés (un par ligne)").inputValue()).split("\n"),
  ).toEqual(links.slice(1));
});

test("Should_JoinAsGuest_When_OpeningInviteLinkWhileLoggedOut", async ({ browser }) => {
  const host = await newGuest(browser);
  const code = await createRace(host.page, /Privée/);
  const [link] = await generateInvites(host.page, 1);

  const page = await (await browser.newContext()).newPage();
  await page.goto(link);
  await page.getByRole("button", { name: "Rejoindre en invité" }).click();

  await expect(page).toHaveURL(`/lobbies/${code}`);
  await expect(participants(host.page)).toHaveCount(2);
});

test("Should_ReturnToInvite_When_SigningUpFromInviteLink", async ({ browser }) => {
  const host = await newGuest(browser);
  const code = await createRace(host.page, /Privée/);
  const [link] = await generateInvites(host.page, 1);

  const page = await (await browser.newContext()).newPage();
  await page.goto(link);
  await page.getByRole("link", { name: "Tu as un compte ? Connecte-toi d'abord." }).click();
  await page.getByRole("link", { name: "Créer un compte" }).click();
  await expect(page.getByRole("heading", { name: "Créer un compte" })).toBeVisible();
  await page.getByLabel("Nom d'utilisateur").fill(`e2e_${Date.now().toString(36)}`);
  await page.getByLabel("Mot de passe").fill("motdepasse-solide");
  await page.getByRole("button", { name: "Créer le compte" }).click();

  await expect(page).toHaveURL(new URL(link).pathname);
  await page.getByRole("button", { name: "Rejoindre la course" }).click();
  await expect(page).toHaveURL(`/lobbies/${code}`);
});

test("Should_SendEveryoneBackToListAndForgetCode_When_HostClosesRace", async ({ browser }) => {
  const host = await newGuest(browser);
  const code = await createRace(host.page, /Publique/);
  const player = await newGuest(browser);
  await player.page.goto(`/lobbies/${code}`);
  await expect(participants(player.page)).toHaveCount(2);
  await expect(player.page.getByRole("button", { name: "Fermer la course" })).toHaveCount(0);

  host.page.once("dialog", (dialog) => dialog.accept());
  await host.page.getByRole("button", { name: "Fermer la course" }).click();

  for (const page of [host.page, player.page]) {
    await expect(page).toHaveURL("/lobbies?closed=1");
    await expect(page.getByRole("status")).toHaveText("Cette course a été fermée par l'hôte.");
    await expect(page.getByText(`Course de ${host.name}`)).toHaveCount(0);
  }
  await player.page.getByLabel("Code de la course").fill(code);
  await player.page.getByRole("button", { name: "Rejoindre" }).click();
  await expect(player.page.getByRole("alert").filter({ hasText: "code" })).toHaveText(
    "Aucune course ouverte avec ce code.",
  );
});

test("Should_ShowSameCountdownThenSameText_When_HostStartsRace", async ({ browser }) => {
  const host = await newGuest(browser);
  const code = await createRace(host.page, /Non répertoriée/);
  const start = host.page.getByRole("button", { name: "Lancer la course" });
  await expect(start).toBeDisabled();

  const player = await newGuest(browser);
  await player.page.goto(`/lobbies/${code}`);
  await expect(participants(host.page)).toHaveCount(2);
  await expect(player.page.getByRole("button", { name: "Lancer la course" })).toHaveCount(0);
  await start.click();

  for (const { page } of [host, player]) {
    await expect(page.getByRole("timer")).toHaveText(/^Départ dans [1-5]$/);
  }
  const hostText = host.page.locator(".typing-text");
  await expect(hostText).toBeVisible({ timeout: 8000 });
  await expect(player.page.locator(".typing-text")).toHaveText((await hostText.textContent())!);
});

test("Should_BlockAndCountError_When_RacerTypesWrongCharacter", async ({ browser }) => {
  const host = await newGuest(browser);
  const code = await createRace(host.page, /Non répertoriée/);
  const player = await newGuest(browser);
  await player.page.goto(`/lobbies/${code}`);
  await expect(participants(host.page)).toHaveCount(2);
  await host.page.getByRole("button", { name: "Lancer la course" }).click();

  const input = player.page.getByRole("textbox", { name: "Tape le texte" });
  await expect(input).toBeFocused({ timeout: 8000 });
  const text = (await player.page.locator(".typing-text").textContent())!;
  // Un caractère sûrement faux : ~ n'apparaît dans aucun texte de la banque.
  await player.page.keyboard.type(`${text[0]}~`);

  await expect(input).toHaveValue(text[0]);
  await expect(player.page.locator(".typing-text .typed-wrong")).toHaveText(text[1]);
  await expect(player.page.getByRole("status")).toHaveText("1 faute");
});
