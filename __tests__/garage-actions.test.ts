// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
import { redirect } from "next/navigation";
import { saveLoadoutAction } from "../app/actions/garage";
import { saveLoadout } from "../lib/garage";
import { getCurrentUser } from "../lib/session-cookie";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("../lib/session-cookie", () => ({ getCurrentUser: vi.fn() }));
vi.mock("../lib/garage", () => ({ saveLoadout: vi.fn() }));

const aUser = {
  id: "user-1",
  username: "alex",
  passwordHash: "hash",
  isGuest: false,
  car: "octane",
  boost: "standard",
  hat: "none",
  ball: "none",
  rankLevel: 0,
  createdAt: new Date(),
};
const aGuest = { ...aUser, username: "Invité-123456", passwordHash: null, isGuest: true };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const choice = { car: "dominus", boost: "flames", hat: "cone", ball: "beach" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(aUser);
});

test("Should_SaveLoadout_When_RegisteredUserSubmitsValidChoice", async () => {
  expect(await saveLoadoutAction(undefined, form(choice))).toEqual({ saved: true });
  expect(saveLoadout).toHaveBeenCalledWith("user-1", choice);
});

test("Should_RefuseWithoutSaving_When_UserIsGuest", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(aGuest);

  expect(await saveLoadoutAction(undefined, form(choice))).toEqual({ error: "guest" });
  expect(saveLoadout).not.toHaveBeenCalled();
});

test("Should_RedirectHome_When_NobodyIsLoggedIn", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);

  await expect(saveLoadoutAction(undefined, form(choice))).rejects.toThrow("NEXT_REDIRECT");
  expect(redirect).toHaveBeenCalledWith("/");
  expect(saveLoadout).not.toHaveBeenCalled();
});

test.each([
  ["boost is none", { ...choice, boost: "none" }],
  ["item is unknown", { ...choice, hat: "crown" }],
])("Should_RefuseWithoutSaving_When_%s", async (_name, fields) => {
  expect(await saveLoadoutAction(undefined, form(fields))).toEqual({ error: "invalid" });
  expect(saveLoadout).not.toHaveBeenCalled();
});

test("Should_RefuseWithoutSaving_When_BoostIsMissing", async () => {
  const data = form(choice);
  data.delete("boost");

  expect(await saveLoadoutAction(undefined, data)).toEqual({ error: "invalid" });
  expect(saveLoadout).not.toHaveBeenCalled();
});

test.each(["standard", "flames", "ion", "sparkles"])("Should_SaveBoost_When_Selecting_%s", async (boost) => {
  const loadout = { ...choice, boost };
  expect(await saveLoadoutAction(undefined, form(loadout))).toEqual({ saved: true });
  expect(saveLoadout).toHaveBeenCalledWith("user-1", loadout);
});
