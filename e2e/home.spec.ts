import { expect, test } from "@playwright/test";

test("Should_DisplayMainHeading_When_VisitingHomePage", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("Should_UseArcadeTitleFont_When_VisitingHomePage", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-family", /Russo One/);
});
