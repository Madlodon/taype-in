import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import RootLayout from "../app/layout";
import type { ReactNode } from "react";

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));
vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  const messages = (await import("../messages/fr.json")).default;
  return {
    ...actual,
    NextIntlClientProvider: ({ children }: { children: ReactNode }) => (
      <actual.NextIntlClientProvider locale="fr" messages={messages}>{children}</actual.NextIntlClientProvider>
    ),
  };
});

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "geist" }),
  JetBrains_Mono: () => ({ variable: "mono" }),
  Russo_One: () => ({ variable: "russo" }),
}));
vi.mock("../lib/session-cookie", () => ({ getCurrentUser: async () => null }));
vi.mock("../components/locale-switcher", () => ({ LocaleSwitcher: () => null }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

afterEach(cleanup);

test("Should_ShowOrangeLogosBeforeNavigationAndBlueLogosAfter_When_HeaderRenders", async () => {
  render(await RootLayout({ children: <main />, params: Promise.resolve({}) }));

  const header = screen.getByRole("banner");
  const logos = within(header).getAllByRole("img", { name: "Taype-in" });
  const navigation = within(header).getByRole("navigation");
  const sources = logos.map((logo) => logo.getAttribute("src"));

  // Chaque côté a une version claire et une version sombre.
  expect(logos).toHaveLength(4);
  expect(sources[0]).toContain("taype-in-orange.png");
  expect(sources[1]).toContain("taype-in-orange-dark.png");
  expect(sources[2]).toContain("taype-in-blue.png");
  expect(sources[3]).toContain("taype-in-blue-dark.png");
  expect(logos[1].compareDocumentPosition(navigation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(navigation.compareDocumentPosition(logos[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  for (const logo of logos) {
    expect(logo.closest("a")?.getAttribute("href")).toBe("/");
  }
});

test("Should_HideDarkLogosInLightTheme_When_HeaderRenders", async () => {
  render(await RootLayout({ children: <main />, params: Promise.resolve({}) }));

  const logos = within(screen.getByRole("banner")).getAllByRole("img", { name: "Taype-in" });

  for (const logo of logos) {
    const isDark = logo.getAttribute("src")!.includes("-dark.png");
    expect(logo.className).toBe(isDark ? "hidden dark:block" : "dark:hidden");
  }
});
