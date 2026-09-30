import { beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "next-themes";
import { ThemeSwitcher } from "../components/theme-switcher";
import fr from "../messages/fr.json";

// jsdom n'a pas matchMedia, que next-themes utilise pour le thème du système.
vi.stubGlobal("matchMedia", () => ({
  matches: false,
  addListener: vi.fn(),
  removeListener: vi.fn(),
}));

function renderSwitcher() {
  return render(
    <ThemeProvider attribute="class">
      <NextIntlClientProvider locale="fr" messages={fr}>
        <ThemeSwitcher />
      </NextIntlClientProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.className = "";
});

test("Should_OfferLightDarkAndSystem_When_Rendered", () => {
  renderSwitcher();

  expect(screen.getByRole("button", { name: "Clair" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Sombre" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Système" })).toBeDefined();
});

test("Should_FollowSystem_When_NoThemeChosen", () => {
  renderSwitcher();

  expect(screen.getByRole("button", { name: "Système", pressed: true })).toBeDefined();
});

test("Should_ApplyAndSaveDarkTheme_When_DarkClicked", () => {
  renderSwitcher();

  fireEvent.click(screen.getByRole("button", { name: "Sombre" }));

  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(localStorage.getItem("theme")).toBe("dark");
  expect(screen.getByRole("button", { name: "Sombre", pressed: true })).toBeDefined();
});

test("Should_RemoveDarkClass_When_LightClickedAfterDark", () => {
  renderSwitcher();

  fireEvent.click(screen.getByRole("button", { name: "Sombre" }));
  fireEvent.click(screen.getByRole("button", { name: "Clair" }));

  expect(document.documentElement.classList.contains("dark")).toBe(false);
  expect(screen.getByRole("button", { name: "Clair", pressed: true })).toBeDefined();
});
