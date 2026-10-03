// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  createInvitesAction,
  createLobbyAction,
  joinInviteAction,
  joinLobbyAction,
} from "../app/actions/lobbies";
import * as auth from "../lib/auth";
import * as lobbies from "../lib/lobbies";
import { getCurrentUser, setSessionCookie } from "../lib/session-cookie";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("../lib/session-cookie", () => ({ getCurrentUser: vi.fn(), setSessionCookie: vi.fn() }));
vi.mock("../lib/auth", () => ({ createGuest: vi.fn(), createSession: vi.fn() }));
vi.mock("../lib/lobbies", () => ({
  MAX_INVITES: 300,
  canEnterLobby: vi.fn(),
  claimInvite: vi.fn(),
  createInvites: vi.fn(),
  createLobby: vi.fn(),
  findOpenLobby: vi.fn(),
}));

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
  textLanguage: "fr" as const,
  textLength: 100,
  errorMode: "blocking" as const,
  createdAt: new Date(),
  closedAt: null,
};
const aPrivateLobby = { ...aLobby, visibility: "private" as const };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(aGuest);
  vi.mocked(lobbies.createLobby).mockResolvedValue(aLobby);
  vi.mocked(lobbies.canEnterLobby).mockResolvedValue(true);
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

  expect(lobbies.createLobby).toHaveBeenCalledWith("user-1", "public", expect.anything());
  expect(redirect).toHaveBeenCalledWith("/lobbies/K7P3XM");
});

test("Should_CreatePrivateLobby_When_VisibilityIsPrivate", async () => {
  await expect(createLobbyAction(form({ visibility: "private" }))).rejects.toThrow(
    "NEXT_REDIRECT",
  );

  expect(lobbies.createLobby).toHaveBeenCalledWith("user-1", "private", expect.anything());
});

test.each([
  ["missing", {}],
  ["unknown", { visibility: "secret" }],
])("Should_CreateUnlistedLobby_When_VisibilityIs_%s", async (_, fields) => {
  vi.mocked(getCurrentUser).mockResolvedValue(aGuest);

  await expect(createLobbyAction(form(fields))).rejects.toThrow("NEXT_REDIRECT");

  expect(lobbies.createLobby).toHaveBeenCalledWith("user-1", "unlisted", expect.anything());
});

test("Should_SaveTextSettings_When_HostPicksLanguageAndLength", async () => {
  await expect(
    createLobbyAction(form({ visibility: "public", textLanguage: "en", textLength: "200" })),
  ).rejects.toThrow("NEXT_REDIRECT");

  expect(lobbies.createLobby).toHaveBeenCalledWith("user-1", "public", {
    textLanguage: "en",
    textLength: 200,
    errorMode: "blocking",
  });
});

test.each([
  ["missing", {}],
  ["unknown", { textLanguage: "es", textLength: "75" }],
])("Should_UseFrenchAndHundredWords_When_TextSettingsAre_%s", async (_, fields) => {
  await expect(createLobbyAction(form(fields))).rejects.toThrow("NEXT_REDIRECT");

  expect(lobbies.createLobby).toHaveBeenCalledWith("user-1", "unlisted", {
    textLanguage: "fr",
    textLength: 100,
    errorMode: "blocking",
  });
});

test("Should_SaveTolerantMode_When_HostPicksTolerant", async () => {
  await expect(createLobbyAction(form({ errorMode: "tolerant" }))).rejects.toThrow("NEXT_REDIRECT");

  expect(lobbies.createLobby).toHaveBeenCalledWith(
    "user-1",
    "unlisted",
    expect.objectContaining({ errorMode: "tolerant" }),
  );
});

test("Should_UseBlockingMode_When_ErrorModeIsUnknown", async () => {
  await expect(createLobbyAction(form({ errorMode: "lenient" }))).rejects.toThrow("NEXT_REDIRECT");

  expect(lobbies.createLobby).toHaveBeenCalledWith(
    "user-1",
    "unlisted",
    expect.objectContaining({ errorMode: "blocking" }),
  );
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

  expect(state).toEqual({ error: "noOpenLobby", code: "ZZZZZZ" });
  expect(redirect).not.toHaveBeenCalled();
});

test("Should_ReturnErrorWithoutLookup_When_CodeIsBlank", async () => {
  const state = await joinLobbyAction(undefined, form({ code: "   " }));

  expect(state?.error).toBe("noOpenLobby");
  expect(lobbies.findOpenLobby).not.toHaveBeenCalled();
});

test("Should_ReturnError_When_CodeIsForPrivateLobbyWithoutInvite", async () => {
  vi.mocked(lobbies.findOpenLobby).mockResolvedValue(aPrivateLobby);
  vi.mocked(lobbies.canEnterLobby).mockResolvedValue(false);

  const state = await joinLobbyAction(undefined, form({ code: "K7P3XM" }));

  expect(state).toEqual({ error: "noOpenLobby", code: "K7P3XM" });
  expect(lobbies.canEnterLobby).toHaveBeenCalledWith(aPrivateLobby, "user-1");
  expect(redirect).not.toHaveBeenCalled();
});

test("Should_RedirectHome_When_JoiningByCodeWhileLoggedOut", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);

  await expect(joinLobbyAction(undefined, form({ code: "K7P3XM" }))).rejects.toThrow(
    "NEXT_REDIRECT",
  );

  expect(redirect).toHaveBeenCalledWith("/");
});

describe("createInvitesAction", () => {
  beforeEach(() => {
    vi.mocked(lobbies.findOpenLobby).mockResolvedValue(aPrivateLobby);
  });

  test("Should_CreateRequestedNumberOfLinksAndRefresh_When_HostAsks", async () => {
    await createInvitesAction(form({ code: "K7P3XM", count: "30" }));

    expect(lobbies.createInvites).toHaveBeenCalledWith("lobby-1", 30);
    expect(refresh).toHaveBeenCalled();
  });

  test("Should_CreateNoLink_When_UserIsNotHost", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...aGuest, id: "user-2" });

    await createInvitesAction(form({ code: "K7P3XM", count: "30" }));

    expect(lobbies.createInvites).not.toHaveBeenCalled();
  });

  test("Should_CreateNoLink_When_LobbyIsNotPrivate", async () => {
    vi.mocked(lobbies.findOpenLobby).mockResolvedValue(aLobby);

    await createInvitesAction(form({ code: "K7P3XM", count: "30" }));

    expect(lobbies.createInvites).not.toHaveBeenCalled();
  });

  test("Should_CreateNoLink_When_LobbyIsClosedOrMissing", async () => {
    vi.mocked(lobbies.findOpenLobby).mockResolvedValue(null);

    await createInvitesAction(form({ code: "K7P3XM", count: "30" }));

    expect(lobbies.createInvites).not.toHaveBeenCalled();
  });

  test.each([["0"], ["-3"], ["301"], ["2.5"], ["abc"], [""]])(
    "Should_CreateNoLink_When_CountIs_%s",
    async (count) => {
      await createInvitesAction(form({ code: "K7P3XM", count }));

      expect(lobbies.createInvites).not.toHaveBeenCalled();
    },
  );

  test.each([["1"], ["300"]])("Should_CreateLinks_When_CountIsAtBound_%s", async (count) => {
    await createInvitesAction(form({ code: "K7P3XM", count }));

    expect(lobbies.createInvites).toHaveBeenCalledWith("lobby-1", Number(count));
  });

  test("Should_RedirectHome_When_NobodyIsLoggedIn", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(
      createInvitesAction(form({ code: "K7P3XM", count: "30" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(lobbies.createInvites).not.toHaveBeenCalled();
  });
});

describe("joinInviteAction", () => {
  test("Should_ClaimLinkAndOpenLobby_When_UserIsLoggedIn", async () => {
    vi.mocked(lobbies.claimInvite).mockResolvedValue(aPrivateLobby);

    await expect(joinInviteAction(form({ token: "abc" }))).rejects.toThrow("NEXT_REDIRECT");

    expect(lobbies.claimInvite).toHaveBeenCalledWith("abc", "user-1");
    expect(auth.createGuest).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/lobbies/K7P3XM");
  });

  test("Should_PlayAsGuest_When_NobodyIsLoggedIn", async () => {
    const expiresAt = new Date();
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    vi.mocked(auth.createGuest).mockResolvedValue({ ...aGuest, id: "guest-9" });
    vi.mocked(auth.createSession).mockResolvedValue({ token: "jeton", expiresAt });
    vi.mocked(lobbies.claimInvite).mockResolvedValue(aPrivateLobby);

    await expect(joinInviteAction(form({ token: "abc" }))).rejects.toThrow("NEXT_REDIRECT");

    expect(setSessionCookie).toHaveBeenCalledWith("jeton", expiresAt);
    expect(lobbies.claimInvite).toHaveBeenCalledWith("abc", "guest-9");
    expect(redirect).toHaveBeenCalledWith("/lobbies/K7P3XM");
  });

  test("Should_ReturnToInvitePage_When_LinkIsNoLongerValid", async () => {
    vi.mocked(lobbies.claimInvite).mockResolvedValue(null);

    await expect(joinInviteAction(form({ token: "abc" }))).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/invite/abc");
  });
});
