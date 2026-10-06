import { expect, test } from "@playwright/test";
import fr from "../messages/fr.json";

test("Should_CompleteAndRestart_When_TryingTheArena", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Essayer la course" }).click();
  await expect(page.getByRole("link", { name: "Entraînement", exact: true })).toHaveAttribute("aria-current", "page");
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
