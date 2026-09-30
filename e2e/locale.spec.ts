import { expect, test } from "@playwright/test";

test("Should_ShowEnglishAndKeepIt_When_SwitchingLanguage", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("button", { name: "Jouer en invité" })).toBeVisible();

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("button", { name: "Play as guest" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();

  await page.getByRole("button", { name: "Français" }).click();
  await expect(page.getByRole("heading", { name: "Se connecter" })).toBeVisible();
});

test.describe("English browser", () => {
  test.use({ locale: "en-US" });

  test("Should_ShowEnglish_When_BrowserPrefersEnglish", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Play as guest" })).toBeVisible();
  });
});
