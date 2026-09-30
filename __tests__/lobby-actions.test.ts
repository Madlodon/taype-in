// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
import { redirect } from "next/navigation";
import { createLobbyAction, joinLobbyAction } from "../app/actions/lobbies";
import * as lobbies from "../lib/lobbies";
import { getCurrentUser } from "../lib/session-cookie";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("../lib/session-cookie", () => ({ getCurrentUser: vi.fn() }));
vi.mock("../lib/lobbies", () => ({ createLobby: vi.fn(), findOpenLobby: vi.fn() }));

const aGuest = {
  id: "user-1",
  username: "Invité-123456",
  passwordHash: null,
  isGuest: true,
  createdAt: new Date(),
};
const aLobby = {
  id: "lobby-1",
  code: "K7P3XM",
  visibility: "unlisted" as const,
  hostId: "user-1",
  createdAt: new Date(),
  closedAt: null,
};

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(lobbies.createLobby).mockResolvedValue(aLobby);
});

test("Should_RedirectHomeWithoutCreating_When_NobodyIsLoggedIn", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);

  await expect(createLobbyAction(form({ visibility: "public" }))).rejects.toThrow(
    "NEXT_REDIRECT",
  );

  expect(redirect).toHaveBeenCalledWith("/");
  expect(lobbies.createLobby).not.toHaveBeenCalled();
});

test("Should_MakeGuestHostAndOpenLobby_When_GuestCreatesLobby", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(aGuest);

  await expect(createLobbyAction(form({ visibility: "public" }))).rejects.toThrow(
    "NEXT_REDIRECT",
  );

  expect(lobbies.createLobby).toHaveBeenCalledWith("user-1", "public");
  expect(redirect).toHaveBeenCalledWith("/lobbies/K7P3XM");
});

test.each([
  ["missing", {}],
  ["private (not offered yet)", { visibility: "private" }],
  ["unknown", { visibility: "secret" }],
])("Should_CreateUnlistedLobby_When_VisibilityIs_%s", async (_, fields) => {
  vi.mocked(getCurrentUser).mockResolvedValue(aGuest);

  await expect(createLobbyAction(form(fields))).rejects.toThrow("NEXT_REDIRECT");

  expect(lobbies.createLobby).toHaveBeenCalledWith("user-1", "unlisted");
});

test("Should_RedirectToLobby_When_CodeMatchesOpenLobby", async () => {
  vi.mocked(lobbies.findOpenLobby).mockResolvedValue(aLobby);

  await expect(joinLobbyAction(undefined, form({ code: "k7p3xm" }))).rejects.toThrow(
    "NEXT_REDIRECT",
  );

  expect(lobbies.findOpenLobby).toHaveBeenCalledWith("k7p3xm");
  expect(redirect).toHaveBeenCalledWith("/lobbies/K7P3XM");
});

test("Should_ReturnErrorAndKeepCode_When_NoOpenLobbyHasThisCode", async () => {
  vi.mocked(lobbies.findOpenLobby).mockResolvedValue(null);

  const state = await joinLobbyAction(undefined, form({ code: "ZZZZZZ" }));

  expect(state).toEqual({ error: "Aucune course ouverte avec ce code.", code: "ZZZZZZ" });
  expect(redirect).not.toHaveBeenCalled();
});

test("Should_ReturnErrorWithoutLookup_When_CodeIsBlank", async () => {
  const state = await joinLobbyAction(undefined, form({ code: "   " }));

  expect(state?.error).toBe("Aucune course ouverte avec ce code.");
  expect(lobbies.findOpenLobby).not.toHaveBeenCalled();
});
