import { expect, test, type Page } from "@playwright/test";

// Image PNG de 1 × 1 pixel.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function signUp(page: Page, prefix: string) {
  const username = `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  await page.goto("/signup");
  await page.getByLabel("Nom d'utilisateur").fill(username);
  await page.getByLabel("Mot de passe").fill("motdepasse123");
  await page.getByRole("button", { name: "Créer le compte" }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("navigation").getByRole("link", { name: "Mon profil" }).click();
  // Sur la CI, le serveur de dev compile la page du profil à la première visite : ça dépasse parfois 5 s.
  await expect(page).toHaveURL(`/profile/${username}`, { timeout: 15_000 });
  return username;
}

test("Should_ShowYouBadgeOnlyToOwner_When_VisitingAProfile", async ({ page }) => {
  const username = await signUp(page, "e2e");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(username);
  await expect(page.getByText("Toi", { exact: true })).toBeVisible();
  await expect(page.getByText("Aucune course pour l’instant.")).toBeVisible();

  await page.goto("/");
  // Un préchargement encore en cours remettrait le cookie de session après la déconnexion.
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page.getByRole("button", { name: "Jouer en invité" })).toBeVisible();
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

test("Should_ShowPhotoThenInitials_When_OwnerUploadsThenRemovesPhoto", async ({ page }) => {
  await signUp(page, "e2e_pic");
  const avatar = page.locator("main img.avatar");
  const contentType = async () =>
    (await page.request.get((await avatar.getAttribute("src"))!)).headers()["content-type"];
  expect(await contentType()).toBe("image/svg+xml");

  await page.getByLabel(/Photo de profil/).setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Téléverser" }).click();

  await expect(avatar).toHaveAttribute("src", /\?v=\d+$/);
  await expect(page.locator("nav img.avatar")).toHaveAttribute("src", /\?v=\d+$/);
  expect(await contentType()).toBe("image/webp");

  await page.getByRole("button", { name: "Retirer la photo" }).click();

  await expect(avatar).toHaveAttribute("src", /^\/avatars\/[0-9a-f-]+$/);
  expect(await contentType()).toBe("image/svg+xml");
});

test("Should_RefuseFile_When_ItIsNotAnImage", async ({ page }) => {
  await signUp(page, "e2e_badpic");

  await page.getByLabel(/Photo de profil/).setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from("pas une image"),
  });
  await page.getByRole("button", { name: "Téléverser" }).click();

  await expect(page.getByText("Choisis une image PNG, JPEG ou WebP.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retirer la photo" })).toHaveCount(0);
});

test("Should_LeaveSessionCookieAlone_When_LoadingAPhoto", async ({ page }) => {
  await signUp(page, "e2e_cookie");
  const src = (await page.locator("nav img.avatar").getAttribute("src"))!;

  const response = await page.request.get(src);

  expect(response.status()).toBe(200);
  expect(response.headers()["set-cookie"]).toBeUndefined();
});
