import { expect, test } from "@playwright/test";
import fr from "../messages/fr.json";

test("Should_CompleteAndRestart_When_TryingTheArena", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Essayer la course" }).click();
  await expect(page.getByRole("link", { name: "L’arène", exact: true })).toHaveAttribute("aria-current", "page");
  const input = page.getByLabel("Recopie le texte ci-dessus");
  await input.fill("X");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  await input.fill(fr.Race.prompt);
  await expect(page.getByRole("status")).toContainText(fr.Race.finished);
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  await page.getByRole("button", { name: /Recommencer/ }).click();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
});

test("Should_ResetPreviewInNewLanguage_When_LocaleChanges", async ({ page }) => {
  await page.goto("/race");
  await page.getByRole("textbox").fill("Ton clavier");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("textbox")).toHaveValue("");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByLabel("Type the text above")).toBeVisible();
});

for (const width of [375, 768, 1440]) {
  test(`Should_FitEveryPage_When_ViewportIs${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/", "/login", "/signup", "/race"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.getByRole("button", { name: "Sombre" }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.goto("/");
    await page.getByRole("button", { name: "Jouer en invité" }).click();
    await page.getByRole("link", { name: "Démarrer une course" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("link", { name: "Créer une course", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByLabel(/Non répertoriée/).check();
    await page.getByRole("button", { name: "Créer la course", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Salle d'attente" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
