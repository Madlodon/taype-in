// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { removeAvatarAction, uploadAvatarAction } from "../app/actions/avatar";
import { removeAvatar, saveAvatar } from "../lib/avatars";
import { getCurrentUser } from "../lib/session-cookie";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("../lib/session-cookie", () => ({ getCurrentUser: vi.fn() }));
vi.mock("../lib/avatars", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/avatars")>()),
  saveAvatar: vi.fn(),
  removeAvatar: vi.fn(),
}));

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
const photo = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "photo.png", { type: "image/png" });

function form(file?: File, crop?: Record<string, string>) {
  const data = new FormData();
  if (file) data.set("photo", file);
  for (const [name, value] of Object.entries(crop ?? {})) data.set(name, value);
  return data;
}

const CROP = { cropX: "10", cropY: "0", cropWidth: "80", cropHeight: "80" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(aUser);
  vi.mocked(saveAvatar).mockResolvedValue({});
});

test("Should_SavePhotoAndRefresh_When_OwnerUploads", async () => {
  expect(await uploadAvatarAction(undefined, form(photo))).toBeUndefined();
  expect(saveAvatar).toHaveBeenCalledWith("user-1", expect.any(File), undefined);
  expect(refresh).toHaveBeenCalled();
});

test("Should_PassChosenArea_When_CropIsSent", async () => {
  expect(await uploadAvatarAction(undefined, form(photo, CROP))).toBeUndefined();
  expect(saveAvatar).toHaveBeenCalledWith("user-1", expect.any(File), { x: 10, y: 0, width: 80, height: 80 });
});

test.each([
  ["a negative x", { ...CROP, cropX: "-1" }],
  ["a zero width", { ...CROP, cropWidth: "0" }],
  ["a decimal height", { ...CROP, cropHeight: "80.5" }],
  ["a missing y", { cropX: "10", cropWidth: "80", cropHeight: "80" }],
  ["text", { ...CROP, cropX: "abc" }],
])("Should_RefuseWithoutSaving_When_CropHas_%s", async (_name, crop) => {
  expect(await uploadAvatarAction(undefined, form(photo, crop))).toEqual({ error: "crop" });
  expect(saveAvatar).not.toHaveBeenCalled();
});

test.each(["tooLarge", "type", "crop"] as const)("Should_ReturnError_When_StorageRefuses_%s", async (error) => {
  vi.mocked(saveAvatar).mockResolvedValue({ error });

  expect(await uploadAvatarAction(undefined, form(photo))).toEqual({ error });
  expect(refresh).not.toHaveBeenCalled();
});

test.each([
  ["no file is sent", form()],
  ["file is empty", form(new File([], "vide.png", { type: "image/png" }))],
])("Should_AskForAFile_When_%s", async (_name, data) => {
  expect(await uploadAvatarAction(undefined, data)).toEqual({ error: "missing" });
  expect(saveAvatar).not.toHaveBeenCalled();
});

test("Should_RefuseUpload_When_UserIsGuest", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(aGuest);

  expect(await uploadAvatarAction(undefined, form(photo))).toEqual({ error: "guest" });
  expect(saveAvatar).not.toHaveBeenCalled();
});

test("Should_RedirectHome_When_NobodyIsLoggedIn", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);

  await expect(uploadAvatarAction(undefined, form(photo))).rejects.toThrow("NEXT_REDIRECT");
  await expect(removeAvatarAction()).rejects.toThrow("NEXT_REDIRECT");
  expect(redirect).toHaveBeenCalledWith("/");
  expect(saveAvatar).not.toHaveBeenCalled();
  expect(removeAvatar).not.toHaveBeenCalled();
});

test("Should_RemovePhotoAndRefresh_When_OwnerRemoves", async () => {
  await removeAvatarAction();

  expect(removeAvatar).toHaveBeenCalledWith("user-1");
  expect(refresh).toHaveBeenCalled();
});

test("Should_RemoveNothing_When_UserIsGuest", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(aGuest);

  await removeAvatarAction();

  expect(removeAvatar).not.toHaveBeenCalled();
});
