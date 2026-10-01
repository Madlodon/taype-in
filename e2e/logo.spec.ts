import { expect, test } from "@playwright/test";

test("Should_ShowOrangeCarLogo_When_ThemeIsLight", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("img", { name: "Taype-in" })).toHaveAttribute("src", "/logo-light.svg");
});

test("Should_ShowBlueCarLogo_When_ThemeIsDark", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sombre" }).click();

  await expect(page.getByRole("img", { name: "Taype-in" })).toHaveAttribute("src", "/logo-dark.svg");
});

test("Should_GoHome_When_ClickingLogo", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Taype-in" }).click();

  await expect(page).toHaveURL("/");
});
