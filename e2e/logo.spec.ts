import { expect, test } from "@playwright/test";

test("Should_ShowBlackTextLogos_When_ThemeIsLight", async ({ page }) => {
  await page.goto("/login");

  const logos = page.getByRole("img", { name: "Taype-in" }).filter({ visible: true });
  await expect(logos).toHaveCount(2);
  await expect(logos.nth(0)).toHaveAttribute("src", /taype-in-orange\.png/);
  await expect(logos.nth(1)).toHaveAttribute("src", /taype-in-blue\.png/);
});

test("Should_ShowWhiteTextLogos_When_ThemeIsDark", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sombre" }).click();

  const logos = page.getByRole("img", { name: "Taype-in" }).filter({ visible: true });
  await expect(logos).toHaveCount(2);
  await expect(logos.nth(0)).toHaveAttribute("src", /taype-in-orange-dark\.png/);
  await expect(logos.nth(1)).toHaveAttribute("src", /taype-in-blue-dark\.png/);
});

test("Should_GoHome_When_ClickingLogo", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Taype-in" }).first().click();

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
