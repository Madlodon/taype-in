// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";
import { avatars, users } from "../db/schema";
import {
  getAvatarImage,
  getAvatarVersion,
  initials,
  initialsColor,
  MAX_AVATAR_BYTES,
  removeAvatar,
  saveAvatar,
} from "../lib/avatars";

const createdIds: string[] = [];

async function newUser(username = `t_${Math.random().toString(36).slice(2, 12)}`) {
  const [user] = await db.insert(users).values({ username }).returning();
  createdIds.push(user.id);
  return user;
}

// Juste les premiers octets qui identifient chaque format, complétés jusqu'à size.
const SIGNATURES = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpeg: [0xff, 0xd8, 0xff, 0xe0],
  webp: [...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")],
  gif: [...Buffer.from("GIF89a")],
};

function image(format: keyof typeof SIGNATURES, size = 100, type = `image/${format}`) {
  const bytes = new Uint8Array(size);
  bytes.set(SIGNATURES[format]);
  return new File([bytes], `photo.${format}`, { type });
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "db/migrations" });
});

afterEach(async () => {
  if (createdIds.length === 0) return;
  await db.delete(users).where(inArray(users.id, createdIds.splice(0)));
});

afterAll(async () => {
  await db.$client.end();
});

test.each([
  ["png", "image/png"],
  ["jpeg", "image/jpeg"],
  ["webp", "image/webp"],
] as const)("Should_ServeUploadedPhoto_When_Uploading_%s", async (format, contentType) => {
  const user = await newUser();
  const file = image(format);

  expect(await saveAvatar(user.id, file)).toEqual({});

  const avatar = await getAvatarImage(user.id);
  expect(avatar?.contentType).toBe(contentType);
  expect(avatar?.body).toEqual(new Uint8Array(await file.arrayBuffer()));
});

test("Should_AcceptPhoto_When_ExactlyTwoMegabytes", async () => {
  const user = await newUser();

  expect(await saveAvatar(user.id, image("png", MAX_AVATAR_BYTES))).toEqual({});
});

test("Should_RefuseWithoutSaving_When_PhotoIsOverTwoMegabytes", async () => {
  const user = await newUser();

  expect(await saveAvatar(user.id, image("png", MAX_AVATAR_BYTES + 1))).toEqual({ error: "tooLarge" });
  expect(await getAvatarVersion(user.id)).toBeNull();
});

test.each([
  ["a GIF", image("gif")],
  ["text renamed to .png", new File(["<script>alert(1)</script>"], "photo.png", { type: "image/png" })],
])("Should_RefuseWithoutSaving_When_FileIs_%s", async (_name, file) => {
  const user = await newUser();

  expect(await saveAvatar(user.id, file)).toEqual({ error: "type" });
  expect(await getAvatarVersion(user.id)).toBeNull();
});

test("Should_UseDetectedType_When_BrowserAnnouncesAnotherOne", async () => {
  const user = await newUser();

  await saveAvatar(user.id, image("webp", 100, "image/png"));

  expect((await getAvatarImage(user.id))?.contentType).toBe("image/webp");
});

test("Should_ServeNewPhotoAndChangeVersion_When_PhotoIsReplaced", async () => {
  const user = await newUser();
  await saveAvatar(user.id, image("png"));
  const first = await getAvatarVersion(user.id);

  await saveAvatar(user.id, image("jpeg"));

  expect((await getAvatarImage(user.id))?.contentType).toBe("image/jpeg");
  expect(await getAvatarVersion(user.id)).not.toBe(first);
  expect(await db.select().from(avatars).where(inArray(avatars.userId, [user.id]))).toHaveLength(1);
});

test("Should_ServeInitials_When_PhotoIsRemoved", async () => {
  const user = await newUser("alex_martin");
  await saveAvatar(user.id, image("png"));

  await removeAvatar(user.id);

  const avatar = await getAvatarImage(user.id);
  expect(avatar?.contentType).toBe("image/svg+xml");
  expect(avatar?.body).toContain(">AM</text>");
  expect(await getAvatarVersion(user.id)).toBeNull();
});

test("Should_ServeInitials_When_UserNeverUploaded", async () => {
  const user = await newUser("Invité-123456");

  const avatar = await getAvatarImage(user.id);

  expect(avatar?.contentType).toBe("image/svg+xml");
  expect(avatar?.body).toContain(">I1</text>");
});

test("Should_ReturnNull_When_UserDoesNotExist", async () => {
  expect(await getAvatarImage("00000000-0000-0000-0000-000000000000")).toBeNull();
});

test("Should_DeletePhoto_When_UserIsDeleted", async () => {
  const user = await newUser();
  await saveAvatar(user.id, image("png"));

  await db.delete(users).where(inArray(users.id, [user.id]));

  expect(await getAvatarVersion(user.id)).toBeNull();
});

test.each([
  ["alex", "AL"],
  ["alex_martin", "AM"],
  ["_alex__martin_", "AM"],
  ["x", "X"],
  ["Invité-123456", "I1"],
])("Should_GiveInitials_When_UsernameIs_%s", (username, expected) => {
  expect(initials(username)).toBe(expected);
});

test("Should_KeepSameColor_When_OnlyCaseDiffers", () => {
  expect(initialsColor("Alex")).toBe(initialsColor("alex"));
  expect(initialsColor("alex")).toMatch(/^#[0-9a-f]{6}$/);
});
