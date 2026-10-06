import { expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

test("Should_ShowOrangeLogoBeforeNavigationAndBlueLogoAfter_When_HeaderRenders", async () => {
  render(await RootLayout({ children: <main />, params: Promise.resolve({}) }));

  const header = screen.getByRole("banner");
  const logos = within(header).getAllByRole("img", { name: "Taype-in" });
  const navigation = within(header).getByRole("navigation");

  expect(logos).toHaveLength(2);
  expect(logos[0].getAttribute("src")).toContain("taype-in-orange.png");
  expect(logos[1].getAttribute("src")).toContain("taype-in-blue.png");
  expect(logos[0].compareDocumentPosition(navigation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(navigation.compareDocumentPosition(logos[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  for (const logo of logos) {
    expect(logo.closest("a")?.getAttribute("href")).toBe("/");
  }
});
