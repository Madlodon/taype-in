import { expect, test, type Browser, type Page } from "@playwright/test";

// Chaque joueur a son propre contexte, donc sa propre session invité.
async function newGuest(browser: Browser): Promise<{ page: Page; name: string }> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Jouer en invité" }).click();
  const name = (await page.locator("strong", { hasText: /^Invité-\d{6}$/ }).textContent())!;
  return { page, name };
}

// settings remplit les autres réglages du formulaire avant l'envoi.
async function createRace(
  page: Page,
  visibility: RegExp,
  settings?: (page: Page) => Promise<void>,
): Promise<string> {
  await page.getByRole("link", { name: "Démarrer une course" }).click();
  await page.getByRole("link", { name: "Créer une course" }).click();
  await page.getByLabel(visibility).check();
  await settings?.(page);
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

test("Should_AskToLogIn_When_NotLoggedIn", async ({ page }) => {
  await page.goto("/lobbies");

  await expect(page).toHaveURL("/login?next=/lobbies");
  await expect(page.getByRole("status")).toHaveText("Connecte-toi ou joue en invité pour continuer.");
});

test("Should_ReturnToLobbies_When_LoggingInFromRedirect", async ({ page }) => {
  const username = `lobbies_${Date.now().toString(36)}`;
  await page.goto("/signup");
  await page.getByLabel("Nom d'utilisateur").fill(username);
  await page.getByLabel("Mot de passe").fill("motdepasse123");
  await page.getByRole("button", { name: "Créer le compte" }).click();
  await expect(page.getByText(`Connecté en tant que ${username}`)).toBeVisible();
  await page.context().clearCookies();

  await page.goto("/lobbies");
  await page.getByLabel("Nom d'utilisateur").fill(username);
  await page.getByLabel("Mot de passe").fill("motdepasse123");
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page).toHaveURL("/lobbies");
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

test("Should_ShowSameCountdownThenSameTextAndTimeLeft_When_HostStartsRace", async ({
  browser,
}) => {
  const host = await newGuest(browser);
  const code = await createRace(host.page, /Non répertoriée/, (page) =>
    page.getByLabel(/Durée en minutes/).fill("2"),
  );
  const start = host.page.getByRole("button", { name: "Lancer et courir" });
  await expect(start).toBeDisabled();

  const player = await newGuest(browser);
  await player.page.goto(`/lobbies/${code}`);
  await expect(participants(host.page)).toHaveCount(2);
  await expect(player.page.getByRole("button", { name: "Lancer et courir" })).toHaveCount(0);
  await start.click();

  for (const { page } of [host, player]) {
    await expect(page.getByRole("timer")).toHaveText(/^Départ dans [1-5]$/);
  }
  const hostText = host.page.locator(".typing-text");
  await expect(hostText).toBeVisible({ timeout: 8000 });
  await expect(player.page.locator(".typing-text")).toHaveText((await hostText.textContent())!);
  for (const { page } of [host, player]) {
    await expect(page.getByRole("timer")).toHaveText(/^Temps restant : (2:00|1:5\d)$/);
  }
});

test("Should_ShowNoTimeLeft_When_HostChoosesNoTimer", async ({ browser }) => {
  const host = await newGuest(browser);
  const code = await createRace(host.page, /Non répertoriée/, (page) =>
    page.getByLabel("Pas de minuterie").check(),
  );
  const player = await newGuest(browser);
  await player.page.goto(`/lobbies/${code}`);
  await expect(participants(host.page)).toHaveCount(2);

  await host.page.getByRole("button", { name: "Lancer et courir" }).click();

  await expect(player.page.locator(".typing-text")).toBeVisible({ timeout: 8000 });
  await expect(player.page.getByRole("timer")).toHaveCount(0);
});

test("Should_BlockAndCountError_When_RacerTypesWrongCharacter", async ({ browser }) => {
  const host = await newGuest(browser);
  const code = await createRace(host.page, /Non répertoriée/);
  const player = await newGuest(browser);
  await player.page.goto(`/lobbies/${code}`);
  await expect(participants(host.page)).toHaveCount(2);
  await host.page.getByRole("button", { name: "Lancer et courir" }).click();

  const input = player.page.getByRole("textbox", { name: "Tape le texte" });
  await expect(input).toBeFocused({ timeout: 8000 });
  const text = (await player.page.locator(".typing-text").textContent())!;
  // Un caractère sûrement faux : ~ n'apparaît dans aucun texte de la banque.
  await player.page.keyboard.type(`${text[0]}~`);

  await expect(input).toHaveValue(text[0]);
  await expect(player.page.locator(".typing-text .typed-wrong")).toHaveText(text[1]);
  await expect(player.page.getByRole("status")).toHaveText("1 faute");
});

test("Should_MoveRacerUpTheRankingForEveryone_When_RacerTypes", async ({ browser }) => {
  const host = await newGuest(browser);
  const code = await createRace(host.page, /Non répertoriée/);
  const player = await newGuest(browser);
  await player.page.goto(`/lobbies/${code}`);
  await expect(participants(host.page)).toHaveCount(2);
  await host.page.getByRole("button", { name: "Lancer et courir" }).click();

  const ranking = host.page.getByRole("list", { name: "Classement" }).getByRole("listitem");
  await expect(ranking).toHaveCount(2, { timeout: 8000 });
  await expect(ranking.first()).toHaveText(`${host.name} (toi)0 %`);
  const input = player.page.getByRole("textbox", { name: "Tape le texte" });
  await expect(input).toBeFocused();
  const text = (await player.page.locator(".typing-text").textContent())!;
  await player.page.keyboard.type(text.slice(0, 10));

  await expect(ranking.first()).toHaveText(new RegExp(`^${player.name}\\d+ %$`));
  await expect(ranking.nth(1)).toHaveText(`${host.name} (toi)0 %`);
});

test("Should_ShowOvertakeAboveText_When_RacerPassesAnother", async ({ browser }) => {
  const host = await newGuest(browser);
  const code = await createRace(host.page, /Non répertoriée/);
  const player = await newGuest(browser);
  await player.page.goto(`/lobbies/${code}`);
  await expect(participants(host.page)).toHaveCount(2);
  await host.page.getByRole("button", { name: "Lancer et courir" }).click();
  const ranking = player.page.getByRole("list", { name: "Classement" }).getByRole("listitem");
  await expect(ranking.first()).toHaveText(`${host.name}0 %`, { timeout: 8000 });
  const text = (await player.page.locator(".typing-text").textContent())!;

  await player.page.keyboard.type(text.slice(0, 10));

  await expect(player.page.locator(".overtake")).toHaveText(`▲ Tu as dépassé ${host.name} · 1er`);
  await expect(host.page.locator(".overtake")).toHaveText(`▼ ${player.name} t'a dépassé · 2e`);
});

test("Should_ResumeAtExactPositionWithErrors_When_RacerReloadsMidRace", async ({ browser }) => {
  const host = await newGuest(browser);
  const code = await createRace(host.page, /Non répertoriée/);
  const player = await newGuest(browser);
  await player.page.goto(`/lobbies/${code}`);
  await expect(participants(host.page)).toHaveCount(2);
  await host.page.getByRole("button", { name: "Lancer et courir" }).click();
  const input = player.page.getByRole("textbox", { name: "Tape le texte" });
  await expect(input).toBeFocused({ timeout: 8000 });
  const text = (await player.page.locator(".typing-text").textContent())!;
  await player.page.keyboard.type(`${text.slice(0, 5)}~`);
  await expect(player.page.getByRole("status")).toHaveText("1 faute");

  await player.page.reload();

  await expect(input).toHaveValue(text.slice(0, 5));
  await expect(player.page.getByRole("status")).toHaveText("1 faute");
  await player.page.keyboard.type(text[5]);
  await expect(input).toHaveValue(text.slice(0, 6));
});

test("Should_BecomeSpectator_When_RacerGivesUp", async ({ browser }) => {
  const host = await newGuest(browser);
  const code = await createRace(host.page, /Non répertoriée/);
  const player = await newGuest(browser);
  await player.page.goto(`/lobbies/${code}`);
  await expect(participants(host.page)).toHaveCount(2);
  await host.page.getByRole("button", { name: "Lancer et courir" }).click();
  const input = player.page.getByRole("textbox", { name: "Tape le texte" });
  await expect(input).toBeVisible({ timeout: 8000 });

  player.page.once("dialog", (dialog) => dialog.accept());
  await player.page.getByRole("button", { name: "Abandonner" }).click();

  await expect(input).toHaveCount(0);
  await expect(player.page.getByText("Tu as abandonné")).toBeVisible();
  await expect(host.page.getByRole("textbox", { name: "Tape le texte" })).toBeVisible();
});

test("Should_ShowPodiumAndRankingToEveryone_When_RaceEnds", async ({ browser }) => {
  // Taper tout le texte touche par touche dépasse 30 s sur les machines lentes de la CI.
  test.slow();
  const host = await newGuest(browser);
  const code = await createRace(host.page, /Non répertoriée/);
  const player = await newGuest(browser);
  await player.page.goto(`/lobbies/${code}`);
  await expect(participants(host.page)).toHaveCount(2);
  await host.page.getByRole("button", { name: "Lancer et courir" }).click();
  const input = host.page.getByRole("textbox", { name: "Tape le texte" });
  await expect(input).toBeFocused({ timeout: 8000 });
  player.page.once("dialog", (dialog) => dialog.accept());
  await player.page.getByRole("button", { name: "Abandonner" }).click();
  const text = (await host.page.locator(".typing-text").textContent())!;

  await host.page.keyboard.type(text);

  for (const { page } of [host, player]) {
    await expect(page.getByRole("heading", { name: "Résultats" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Podium" }).getByRole("listitem")).toHaveCount(2);
    const rows = page.getByRole("table", { name: "Classement complet" }).getByRole("row");
    await expect(rows.nth(1)).toContainText(host.name);
    await expect(rows.nth(1)).toContainText("100 %");
    await expect(rows.nth(2)).toContainText(player.name);
    await expect(rows.nth(2)).toContainText("Non terminé");
    // Deux nouveaux invités : le gagnant monte, le perdant reste au plancher (#99).
    await expect(rows.nth(1)).toContainText("Bronze I · Div. II");
    await expect(rows.nth(2)).toContainText("Bronze I · Div. I");
  }
});

test("Should_ShowSessionStatsAndKeepThemOnSignUp_When_GuestRaced", async ({ browser }) => {
  const host = await newGuest(browser);
  const code = await createRace(host.page, /Non répertoriée/);
  const player = await newGuest(browser);
  await player.page.goto(`/lobbies/${code}`);
  await expect(participants(host.page)).toHaveCount(2);
  await host.page.getByRole("button", { name: "Lancer et courir" }).click();
  await expect(player.page.getByRole("textbox", { name: "Tape le texte" })).toBeVisible({ timeout: 8000 });
  for (const { page } of [player, host]) {
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Abandonner" }).click();
  }

  await expect(player.page.getByRole("region", { name: "Cette session : 1 course" })).toBeVisible();

  const username = `e2e_${Math.random().toString(36).slice(2, 10)}`;
  await player.page.goto("/signup");
  await player.page.getByLabel("Nom d'utilisateur").fill(username);
  await player.page.getByLabel("Mot de passe").fill("motdepasse123");
  await player.page.getByRole("button", { name: "Créer le compte" }).click();
  await expect(player.page).toHaveURL("/");
  await player.page.goto(`/profile/${username}`);
  const history = player.page.getByRole("table", { name: "Historique des courses" });
  await expect(history.getByRole("row")).toHaveCount(2);
});

test("Should_RaceWithoutHost_When_HostStartsAndWatches", async ({ browser }) => {
  const host = await newGuest(browser);
  const code = await createRace(host.page, /Non répertoriée/);
  const players = [await newGuest(browser), await newGuest(browser)];
  for (const { page } of players) await page.goto(`/lobbies/${code}`);
  await expect(participants(host.page)).toHaveCount(3);

  await host.page.getByRole("button", { name: "Lancer et regarder" }).click();

  for (const { page } of players) {
    await expect(page.getByRole("textbox", { name: "Tape le texte" })).toBeVisible({
      timeout: 8000,
    });
  }
  await expect(host.page.getByText("Tu regardes la course sans courir.")).toBeVisible();
  await expect(host.page.getByRole("textbox")).toHaveCount(0);
  await expect(participants(host.page).first()).toHaveText(`${host.name} (hôte) (regarde)`);
  await expect(host.page.getByRole("heading", { name: "Participants (2)" })).toBeVisible();
});

test("Should_SendEveryoneToWaitingRoomAndKeepCode_When_HostRelaunchesWithNewSettings", async ({
  browser,
}) => {
  const host = await newGuest(browser);
  const code = await createRace(host.page, /Non répertoriée/);
  const player = await newGuest(browser);
  await player.page.goto(`/lobbies/${code}`);
  await expect(participants(host.page)).toHaveCount(2);
  await host.page.getByRole("button", { name: "Lancer et courir" }).click();
  for (const { page } of [host, player]) {
    await expect(page.getByRole("button", { name: "Abandonner" })).toBeVisible({ timeout: 8000 });
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Abandonner" }).click();
  }
  await expect(player.page.getByRole("heading", { name: "Résultats" })).toBeVisible();

  await host.page.getByRole("button", { name: "Relancer la course" }).click();

  await expect(host.page).toHaveURL(`/lobbies/${code}/settings`);
  await expect(player.page.getByRole("heading", { name: "Résultats" })).toHaveCount(0);
  await expect(player.page.getByText(/En attente de l'hôte/)).toBeVisible();

  await host.page.getByLabel(/Tolérant/).check();
  await host.page.getByRole("button", { name: "Enregistrer et retourner à la salle" }).click();
  await expect(host.page).toHaveURL(`/lobbies/${code}`);
  await expect(participants(player.page)).toHaveCount(2);
  await host.page.getByRole("button", { name: "Lancer et courir" }).click();

  await expect(player.page.getByText(/Mode tolérant/)).toBeVisible({ timeout: 8000 });
});
