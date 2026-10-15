// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
import { redirect } from "next/navigation";
import { changeUsernameAction, revertUsernameAction } from "../app/actions/username";
import { getCurrentUser } from "../lib/session-cookie";
import { changeUsername, revertUsername } from "../lib/username";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("../lib/session-cookie", () => ({ getCurrentUser: vi.fn() }));
vi.mock("../lib/username", () => ({ changeUsername: vi.fn(), revertUsername: vi.fn() }));

const aUser = {
  id: "user-1",
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
  previousUsername: null,
  renamedAt: null,
  createdAt: new Date(),
};
const aGuest = { ...aUser, username: "Invité-123456", passwordHash: null, isGuest: true };

function form(username: string) {
  const data = new FormData();
  data.set("username", username);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(aUser);
});

test("Should_RedirectToNewProfile_When_ChangeSucceeds", async () => {
  vi.mocked(changeUsername).mockResolvedValue({ ...aUser, username: "Alex_2" });

  await expect(changeUsernameAction(undefined, form("  Alex_2 "))).rejects.toThrow("NEXT_REDIRECT");
  expect(changeUsername).toHaveBeenCalledWith(aUser, "Alex_2");
  expect(redirect).toHaveBeenCalledWith("/profile/Alex_2");
});

test.each([
  ["ab", "usernameTooShort"],
  ["a".repeat(21), "usernameTooLong"],
  ["alex!", "usernameInvalid"],
])("Should_ReturnSignupError_When_NameIs_%s", async (username, error) => {
  expect(await changeUsernameAction(undefined, form(username))).toEqual({ error, username });
  expect(changeUsername).not.toHaveBeenCalled();
});

test.each(["cooldown", "same", "taken"] as const)("Should_ReturnError_When_ChangeIsRefused_%s", async (error) => {
  vi.mocked(changeUsername).mockResolvedValue(error);

  expect(await changeUsernameAction(undefined, form("sam"))).toEqual({ error, username: "sam" });
  expect(redirect).not.toHaveBeenCalled();
});

test("Should_RefuseChange_When_UserIsGuest", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(aGuest);

  expect(await changeUsernameAction(undefined, form("sam"))).toEqual({ error: "guest" });
  expect(changeUsername).not.toHaveBeenCalled();
});

test("Should_RedirectHome_When_LoggedOut", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);

  await expect(changeUsernameAction(undefined, form("sam"))).rejects.toThrow("NEXT_REDIRECT");
  expect(redirect).toHaveBeenCalledWith("/");
});

test("Should_RedirectToOldName_When_OwnerReverts", async () => {
  vi.mocked(revertUsername).mockResolvedValue({ ...aUser, username: "old_alex" });

  await expect(revertUsernameAction()).rejects.toThrow("NEXT_REDIRECT");
  expect(redirect).toHaveBeenCalledWith("/profile/old_alex");
});

test("Should_DoNothing_When_RevertIsNotPossible", async () => {
  vi.mocked(revertUsername).mockResolvedValue(null);

  await revertUsernameAction();

  expect(redirect).not.toHaveBeenCalled();
});

test("Should_NotRevert_When_UserIsGuest", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(aGuest);

  await revertUsernameAction();

  expect(revertUsername).not.toHaveBeenCalled();
});
