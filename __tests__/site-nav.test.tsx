import { beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { usePathname } from "next/navigation";
import { SiteNav } from "../components/site-nav";
import fr from "../messages/fr.json";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));

function renderNav(username?: string) {
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <SiteNav username={username} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  cleanup();
  vi.mocked(usePathname).mockReturnValue("/");
});

test("Should_LinkToOwnProfile_When_UserIsRegistered", () => {
  renderNav("alex");

  expect(screen.getByRole("link", { name: "Mon profil" }).getAttribute("href")).toBe("/profile/alex");
});

test("Should_HideProfileLink_When_NoUsernameIsGiven", () => {
  renderNav();

  expect(screen.queryByRole("link", { name: "Mon profil" })).toBeNull();
});

test("Should_MarkProfileLinkCurrent_When_OnOwnProfile", () => {
  vi.mocked(usePathname).mockReturnValue("/profile/alex");

  renderNav("alex");

  expect(screen.getByRole("link", { name: "Mon profil" }).getAttribute("aria-current")).toBe("page");
});

test("Should_NotMarkProfileLinkCurrent_When_OnProfileWithSamePrefix", () => {
  vi.mocked(usePathname).mockReturnValue("/profile/alexandre");

  renderNav("alex");

  expect(screen.getByRole("link", { name: "Mon profil" }).getAttribute("aria-current")).toBeNull();
});

test("Should_MarkLobbiesCurrent_When_InsideALobby", () => {
  vi.mocked(usePathname).mockReturnValue("/lobbies/ABC123");

  renderNav();

  expect(screen.getByRole("link", { name: "Trouver une course" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Accueil" }).getAttribute("aria-current")).toBeNull();
});
