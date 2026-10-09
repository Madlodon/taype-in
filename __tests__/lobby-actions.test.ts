// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  createInvitesAction,
  createLobbyAction,
  joinInviteAction,
  joinLobbyAction,
  updateLobbySettingsAction,
} from "../app/actions/lobbies";
import * as auth from "../lib/auth";
import * as lobbies from "../lib/lobbies";
import { getClientIp } from "../lib/client-ip";
import { CODE_ATTEMPT_LIMIT } from "../lib/rate-limit";
import { getCurrentUser, setSessionCookie } from "../lib/session-cookie";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("../lib/session-cookie", () => ({ getCurrentUser: vi.fn(), setSessionCookie: vi.fn() }));
vi.mock("../lib/auth", () => ({ createGuest: vi.fn(), createSession: vi.fn() }));
vi.mock("../lib/client-ip", () => ({ getClientIp: vi.fn(async () => "203.0.113.1") }));
vi.mock("../lib/lobbies", () => ({
  MAX_INVITES: 300,
  DEFAULT_TIMER_SECONDS: 300,
  TIMER_OPTIONS: Array.from({ length: 20 }, (_, i) => (i + 1) * 30),
  CAPACITY_OPTIONS: Array.from({ length: 29 }, (_, i) => i + 2),
  MAX_CAPACITY: 30,
  canEnterLobby: vi.fn(),
  claimInvite: vi.fn(),
  createInvites: vi.fn(),
  createLobby: vi.fn(),
  findOpenLobby: vi.fn(),
  updateLobbySettings: vi.fn(),
}));

const aGuest = {
  id: "user-1",
  username: "Invité-123456",
  passwordHash: null,
  isGuest: true,
  car: "octane",
  boost: "standard",
  hat: "none",
  ball: "none",
  stadium: "diorama",
  rankLevel: 0,
  xp: 0,
  createdAt: new Date(),
};
const aMember = { ...aGuest, username: "pilote", passwordHash: "hash", isGuest: false };
const aLobby = {
  id: "lobby-1",
  code: "K7P3XM",
  visibility: "unlisted" as const,
  hostId: "user-1",
  textLanguage: "fr" as const,
  textLength: 100,
  errorMode: "blocking" as const,
  timeLimitSeconds: 300,
  capacity: 30,
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
  vi.mocked(getCurrentUser).mockResolvedValue(aMember);
  vi.mocked(getClientIp).mockResolvedValue("203.0.113.1");
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

test("Should_SendToSignUpWithoutCreating_When_GuestCreatesLobby", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(aGuest);

  await expect(createLobbyAction(form({ visibility: "public" }))).rejects.toThrow(
    "NEXT_REDIRECT",
  );

  expect(redirect).toHaveBeenCalledWith("/signup?next=/lobbies/new");
  expect(lobbies.createLobby).not.toHaveBeenCalled();
});

test("Should_MakeUserHostAndOpenLobby_When_RegisteredUserCreatesLobby", async () => {
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
    timeLimitSeconds: 300,
    capacity: 30,
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
    timeLimitSeconds: 300,
    capacity: 30,
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

test.each([
  ["30", 30],
  ["90", 90],
  ["600", 600],
])("Should_SaveTimer_When_HostPicks_%s_Seconds", async (timerSeconds, seconds) => {
  await expect(createLobbyAction(form({ timerSeconds }))).rejects.toThrow("NEXT_REDIRECT");

  expect(lobbies.createLobby).toHaveBeenCalledWith(
    "user-1",
    "unlisted",
    expect.objectContaining({ timeLimitSeconds: seconds }),
  );
});

test.each([["0"], ["29"], ["601"], ["630"], ["45"], ["-30"], ["abc"]])(
  "Should_UseFiveMinutes_When_TimerIs_%s",
  async (timerSeconds) => {
    await expect(createLobbyAction(form({ timerSeconds }))).rejects.toThrow("NEXT_REDIRECT");

    expect(lobbies.createLobby).toHaveBeenCalledWith(
      "user-1",
      "unlisted",
      expect.objectContaining({ timeLimitSeconds: 300 }),
    );
  },
);

test("Should_SaveNoTimer_When_HostChecksNoTimer", async () => {
  await expect(
    createLobbyAction(form({ timerSeconds: "600", noTimer: "on" })),
  ).rejects.toThrow("NEXT_REDIRECT");

  expect(lobbies.createLobby).toHaveBeenCalledWith(
    "user-1",
    "unlisted",
    expect.objectContaining({ timeLimitSeconds: null }),
  );
});

test.each([
  ["2", 2],
  ["8", 8],
  ["30", 30],
])("Should_SaveCapacity_When_HostPicks_%s", async (capacity, count) => {
  await expect(createLobbyAction(form({ capacity }))).rejects.toThrow("NEXT_REDIRECT");

  expect(lobbies.createLobby).toHaveBeenCalledWith(
    "user-1",
    "unlisted",
    expect.objectContaining({ capacity: count }),
  );
});

test.each([["1"], ["31"], ["0"], ["-2"], ["2.5"], ["300"], ["abc"]])(
  "Should_UseThirty_When_CapacityIs_%s",
  async (capacity) => {
    await expect(createLobbyAction(form({ capacity }))).rejects.toThrow("NEXT_REDIRECT");

    expect(lobbies.createLobby).toHaveBeenCalledWith(
      "user-1",
      "unlisted",
      expect.objectContaining({ capacity: 30 }),
    );
  },
);

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

test("Should_ReturnTooManyAttemptsWithoutLookup_When_IpFailedTooOften", async () => {
  vi.mocked(getClientIp).mockResolvedValue("198.51.100.7");
  vi.mocked(lobbies.findOpenLobby).mockResolvedValue(null);
  for (let i = 0; i < CODE_ATTEMPT_LIMIT; i++) {
    await joinLobbyAction(undefined, form({ code: "ZZZZZZ" }));
  }
  vi.mocked(lobbies.findOpenLobby).mockClear().mockResolvedValue(aLobby);

  const state = await joinLobbyAction(undefined, form({ code: "K7P3XM" }));

  expect(state).toEqual({ error: "tooManyAttempts", code: "K7P3XM" });
  expect(lobbies.findOpenLobby).not.toHaveBeenCalled();
});

test("Should_RedirectToLoginThenLobby_When_JoiningByCodeWhileLoggedOut", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  vi.mocked(lobbies.findOpenLobby).mockResolvedValue(aLobby);

  await expect(joinLobbyAction(undefined, form({ code: "k7p3xm" }))).rejects.toThrow(
    "NEXT_REDIRECT",
  );

  expect(redirect).toHaveBeenCalledWith("/login?next=/lobbies/K7P3XM");
});

test("Should_ReturnError_When_LoggedOutCodeMatchesNoOpenLobby", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  vi.mocked(lobbies.findOpenLobby).mockResolvedValue(null);

  const state = await joinLobbyAction(undefined, form({ code: "ZZZZZZ" }));

  expect(state).toEqual({ error: "noOpenLobby", code: "ZZZZZZ" });
  expect(redirect).not.toHaveBeenCalled();
});

test("Should_ReturnError_When_LoggedOutCodeIsForPrivateLobby", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  vi.mocked(lobbies.findOpenLobby).mockResolvedValue(aPrivateLobby);

  const state = await joinLobbyAction(undefined, form({ code: "K7P3XM" }));

  expect(state).toEqual({ error: "noOpenLobby", code: "K7P3XM" });
  expect(lobbies.canEnterLobby).not.toHaveBeenCalled();
  expect(redirect).not.toHaveBeenCalled();
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

  test("Should_CreateLinks_When_LobbyIsJoinedByCode", async () => {
    vi.mocked(lobbies.findOpenLobby).mockResolvedValue(aLobby);

    await createInvitesAction(form({ code: "K7P3XM", count: "30" }));

    expect(lobbies.createInvites).toHaveBeenCalledWith("lobby-1", 30);
  });

  test("Should_CreateNoLink_When_LobbyIsPublic", async () => {
    vi.mocked(lobbies.findOpenLobby).mockResolvedValue({ ...aLobby, visibility: "public" });

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

    expect(lobbies.claimInvite).toHaveBeenCalledWith("abc", "user-1", "203.0.113.1");
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
    expect(lobbies.claimInvite).toHaveBeenCalledWith("abc", "guest-9", "203.0.113.1");
    expect(redirect).toHaveBeenCalledWith("/lobbies/K7P3XM");
  });

  test("Should_ReturnToInvitePage_When_LinkIsNoLongerValid", async () => {
    vi.mocked(lobbies.claimInvite).mockResolvedValue(null);

    await expect(joinInviteAction(form({ token: "abc" }))).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/invite/abc");
  });
});

describe("updateLobbySettingsAction", () => {
  test("Should_SaveSettingsAndReturnToLobby_When_HostSubmits", async () => {
    vi.mocked(lobbies.findOpenLobby).mockResolvedValue(aLobby);

    await expect(
      updateLobbySettingsAction(
        form({
          code: "K7P3XM",
          textLanguage: "en",
          textLength: "50",
          errorMode: "tolerant",
          noTimer: "on",
          capacity: "4",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(lobbies.updateLobbySettings).toHaveBeenCalledWith("lobby-1", {
      textLanguage: "en",
      textLength: 50,
      errorMode: "tolerant",
      timeLimitSeconds: null,
      capacity: 4,
    });
    expect(redirect).toHaveBeenCalledWith("/lobbies/K7P3XM");
  });

  test("Should_RedirectWithoutSaving_When_UserIsNotHost", async () => {
    vi.mocked(lobbies.findOpenLobby).mockResolvedValue({ ...aLobby, hostId: "someone-else" });

    await expect(updateLobbySettingsAction(form({ code: "K7P3XM" }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(lobbies.updateLobbySettings).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/lobbies");
  });

  test("Should_RedirectWithoutSaving_When_LobbyIsClosedOrUnknown", async () => {
    vi.mocked(lobbies.findOpenLobby).mockResolvedValue(null);

    await expect(updateLobbySettingsAction(form({ code: "ZZZZZZ" }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(lobbies.updateLobbySettings).not.toHaveBeenCalled();
  });

  test("Should_RedirectHomeWithoutSaving_When_NobodyIsLoggedIn", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(updateLobbySettingsAction(form({ code: "K7P3XM" }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(redirect).toHaveBeenCalledWith("/");
    expect(lobbies.updateLobbySettings).not.toHaveBeenCalled();
  });
});
