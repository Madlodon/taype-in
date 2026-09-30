import { expect, test } from "@playwright/test";

test.describe("Dark system", () => {
  test.use({ colorScheme: "dark" });

  test("Should_UseDarkTheme_When_SystemPrefersDark", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(page.getByRole("button", { name: "Système" })).toHaveAttribute("aria-pressed", "true");
  });
});

test("Should_KeepChosenTheme_When_Reloading", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);

  await page.getByRole("button", { name: "Sombre" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  await page.goto("/login");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(page.getByRole("button", { name: "Sombre" })).toHaveAttribute("aria-pressed", "true");
});

test("Should_ApplyThemeBeforeContent_When_PageLoads", async ({ page }) => {
  // Note la classe de <html> dès que l'en-tête, le premier contenu visible, est lu.
  await page.addInitScript(() => {
    localStorage.setItem("theme", "dark");
    new MutationObserver((_, observer) => {
      if (!document.querySelector("header")) return;
      (window as unknown as { darkAtHeader: boolean }).darkAtHeader =
        document.documentElement.classList.contains("dark");
      observer.disconnect();
    }).observe(document, { childList: true, subtree: true });
  });

  await page.goto("/");

  expect(await page.evaluate(() => (window as unknown as { darkAtHeader: boolean }).darkAtHeader)).toBe(true);
});
