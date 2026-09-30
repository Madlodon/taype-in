import { expect, test } from "@playwright/test";

test("Should_DisplayMainHeading_When_VisitingHomePage", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("Should_UseArcadeTitleFont_When_VisitingHomePage", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-family", /Russo One/);
});

test("Should_ShowFanDisclaimer_When_VisitingAnyPage", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("contentinfo")).toHaveText(/Non affilié à Epic Games ni à Psyonix/);

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("contentinfo")).toHaveText(/Not affiliated with or endorsed by Epic Games or Psyonix/);
});
