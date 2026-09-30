import { beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Page from "../app/page";
import { getCurrentUser } from "../lib/session-cookie";

vi.mock("../lib/session-cookie", () => ({ getCurrentUser: vi.fn() }));
vi.mock("../app/actions/auth", () => ({
  guestAction: vi.fn(),
  logOutAction: vi.fn(),
}));

const aUser = {
  id: "1",
  username: "alex",
  passwordHash: "hash",
  isGuest: false,
  createdAt: new Date(),
};

beforeEach(() => {
  cleanup();
});

test("Should_RenderMainHeading_When_HomePageIsRendered", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);

  render(await Page());

  expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
});

test("Should_OfferSignUpLogInAndGuest_When_NobodyIsLoggedIn", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);

  render(await Page());

  expect(screen.getByRole("link", { name: "Créer un compte" })).toBeDefined();
  expect(screen.getByRole("link", { name: "Se connecter" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Jouer en invité" })).toBeDefined();
});

test("Should_ShowUsernameAndLogOut_When_UserIsLoggedIn", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(aUser);

  render(await Page());

  expect(screen.getByText("alex")).toBeDefined();
  expect(screen.queryByText(/invité/)).toBeNull();
  expect(screen.getByRole("button", { name: "Se déconnecter" })).toBeDefined();
});

test("Should_LinkToLobbies_When_UserIsLoggedIn", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(aUser);

  render(await Page());

  expect(
    screen.getByRole("link", { name: "Démarrer une course" }).getAttribute("href"),
  ).toBe("/lobbies");
});

test("Should_NotOfferRace_When_NobodyIsLoggedIn", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);

  render(await Page());

  expect(screen.queryByRole("link", { name: "Démarrer une course" })).toBeNull();
});

test("Should_ShowGuestLabel_When_GuestIsLoggedIn", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({
    ...aUser,
    username: "Invité-123456",
    passwordHash: null,
    isGuest: true,
  });

  render(await Page());

  expect(screen.getByText("(invité)", { exact: false })).toBeDefined();
});
