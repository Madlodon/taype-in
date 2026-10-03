import { expect, test } from "@playwright/test";

test("Should_ShowBlueCarLogo_When_ThemeIsLight", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("img", { name: "Taype-in" })).toHaveAttribute("src", /octane-light\.png/);
});

test("Should_ShowOrangeCarLogo_When_ThemeIsDark", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sombre" }).click();

  await expect(page.getByRole("img", { name: "Taype-in" })).toHaveAttribute("src", /octane-dark\.png/);
});

test("Should_GoHome_When_ClickingLogo", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Taype-in" }).click();

  await expect(page).toHaveURL("/");
});

test("Should_ReplaceDefaultMetadata_When_VisitingAnyPage", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Taype-in");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Courses de dactylo/);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", /icon\.svg/);

  await page.getByRole("button", { name: "English" }).click();
  // Next.js peut ajouter la nouvelle balise avant de retirer l'ancienne : on cherche l'anglaise.
  await expect(page.locator('meta[name="description"][content^="Typing races"]')).toBeAttached();
});
