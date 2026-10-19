import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// A11Y-01 à A11Y-04 : contraste AA dans les deux thèmes, balises sémantiques, textes alternatifs et étiquettes.
async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function signUp(page: Page): Promise<string> {
  const name = `a11y_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await page.goto("/signup");
  await page.getByLabel("Nom d'utilisateur").fill(name);
  await page.getByLabel("Mot de passe").fill("motdepasse123");
  await page.getByRole("button", { name: "Créer le compte" }).click();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Mon profil" })).toHaveAttribute("href", `/profile/${name}`);
  return name;
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    for (const path of ["/", "/login", "/signup", "/race", "/page-inexistante"]) {
      test(`Should_HaveNoAxeViolations_When_SignedOutOn${path}`, async ({ page }) => {
        await page.goto(path);
        await expectNoViolations(page);
      });
    }

    test("Should_HaveNoAxeViolations_When_SignedInPagesAreVisited", async ({ page }) => {
      const name = await signUp(page);
      await expectNoViolations(page);

      for (const path of ["/lobbies", "/garage", `/profile/${name}`, "/lobbies/new"]) {
        await page.goto(path);
        await expectNoViolations(page);
      }

      await page.getByRole("button", { name: "Créer la course" }).click();
      await expect(page).toHaveURL(/\/lobbies\/[A-Z2-9]{6}$/);
      await expectNoViolations(page);
    });
  });
}

test("Should_ShowFocus_When_NavigatingWithKeyboard", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Aller au contenu" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  expect(await skip.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});
