import { beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import fr from "../messages/fr.json";
import Page from "../app/page";
import { getCurrentUser } from "../lib/session-cookie";

vi.mock("../lib/session-cookie", () => ({ getCurrentUser: vi.fn() }));
vi.mock("../app/actions/lobbies", () => ({ joinLobbyAction: vi.fn() }));
vi.mock("../app/actions/auth", () => ({
  guestAction: vi.fn(),
  logOutAction: vi.fn(),
}));
// jsdom n'a pas matchMedia : on réduit les animations pour garder l'aperçu de course immobile.
vi.stubGlobal("matchMedia", () => ({ matches: true }));

const aUser = {
  id: "1",
  username: "alex",
  passwordHash: "hash",
  isGuest: false,
  car: "octane",
  boost: "standard",
  hat: "none",
  ball: "none",
  stadium: "diorama",
  rankLevel: 0,
  xp: 0,
  createdAt: new Date(),
};

beforeEach(() => {
  cleanup();
});

// Le formulaire de code est un composant client : il lit ses traductions dans le fournisseur.
async function renderPage() {
  return render(<NextIntlClientProvider locale="fr" messages={fr}>{await Page()}</NextIntlClientProvider>);
}

test("Should_RenderMainHeading_When_HomePageIsRendered", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);

  await renderPage();

  expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
});

test("Should_OfferSignUpLogInAndGuest_When_NobodyIsLoggedIn", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);

  await renderPage();

  expect(screen.getByRole("link", { name: "Créer un compte" })).toBeDefined();
  expect(screen.getByRole("link", { name: "Se connecter" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Jouer en invité" })).toBeDefined();
});

test("Should_ShowUsernameAndLogOut_When_UserIsLoggedIn", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(aUser);

  await renderPage();

  expect(screen.getByText("alex", { selector: "strong" })).toBeDefined();
  expect(screen.queryByText(/invité/)).toBeNull();
  expect(screen.getByRole("button", { name: "Se déconnecter" })).toBeDefined();
});

test("Should_LinkToLobbies_When_UserIsLoggedIn", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(aUser);

  await renderPage();

  expect(
    screen.getByRole("link", { name: "Démarrer une course" }).getAttribute("href"),
  ).toBe("/lobbies");
});

test("Should_NotOfferRace_When_NobodyIsLoggedIn", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);

  await renderPage();

  expect(screen.queryByRole("link", { name: "Démarrer une course" })).toBeNull();
});

test("Should_ShowGuestLabel_When_GuestIsLoggedIn", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({
    ...aUser,
    username: "Invité-123456",
    passwordHash: null,
    isGuest: true,
  });

  await renderPage();

  expect(screen.getByText("(invité)", { exact: false })).toBeDefined();
});

test("Should_ShowBattleInARealStadium_When_HomePageIsRendered", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);

  const { container } = await renderPage();

  expect(container.querySelector(".hero-visual svg[data-stadium='diorama']")).not.toBeNull();
  expect(screen.getByText("Toi")).toBeDefined();
});

test.each([
  ["NobodyIsLoggedIn", null],
  ["UserIsLoggedIn", aUser],
])("Should_OfferJoinByCode_When_%s", async (_, user) => {
  vi.mocked(getCurrentUser).mockResolvedValue(user);

  await renderPage();

  const join = screen.getByRole("region", { name: "Rejoindre avec un code" });
  expect(join.querySelector("input[name='code']")).not.toBeNull();
  expect(screen.getByRole("button", { name: "Rejoindre" })).toBeDefined();
});
