// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import sharp from "sharp";
import { db } from "../db";
import { avatars, users } from "../db/schema";
import {
  AVATAR_SIZE,
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

// Une vraie image d'une seule couleur, complétée par des zéros jusqu'à size si demandé.
async function image(
  format: "png" | "jpeg" | "webp",
  { width = 40, height = 20, color = "#f97316", size = 0, type = `image/${format}` } = {},
) {
  const bytes = await sharp({ create: { width, height, channels: 3, background: color } })[format]().toBuffer();
  const padded = Buffer.concat([bytes, Buffer.alloc(Math.max(0, size - bytes.length))]);
  return new File([padded], `photo.${format}`, { type });
}

// Juste les premiers octets qui identifient le format, le reste est vide.
function signatureOnly(signature: number[], type: string) {
  const bytes = new Uint8Array(100);
  bytes.set(signature);
  return new File([bytes], "photo", { type });
}

async function storedSize(userId: string) {
  const avatar = await getAvatarImage(userId);
  const { format, width, height } = await sharp(avatar!.body as Uint8Array).metadata();
  return { contentType: avatar?.contentType, format, width, height };
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

const SQUARE_WEBP = { contentType: "image/webp", format: "webp", width: AVATAR_SIZE, height: AVATAR_SIZE };

test.each(["png", "jpeg", "webp"] as const)("Should_StoreSquareWebp_When_Uploading_%s", async (format) => {
  const user = await newUser();

  expect(await saveAvatar(user.id, await image(format))).toEqual({});

  expect(await storedSize(user.id)).toEqual(SQUARE_WEBP);
});

test("Should_ShrinkToTargetSize_When_PhotoIsLarge", async () => {
  const user = await newUser();
  const file = await image("jpeg", { width: 3000, height: 2000 });

  await saveAvatar(user.id, file);

  expect(await storedSize(user.id)).toEqual(SQUARE_WEBP);
  expect((await getAvatarImage(user.id))!.body.length).toBeLessThan(file.size);
});

test("Should_AcceptPhoto_When_ExactlyTwoMegabytes", async () => {
  const user = await newUser();

  expect(await saveAvatar(user.id, await image("png", { size: MAX_AVATAR_BYTES }))).toEqual({});
  expect(await storedSize(user.id)).toEqual(SQUARE_WEBP);
});

test("Should_RefuseWithoutSaving_When_PhotoIsOverTwoMegabytes", async () => {
  const user = await newUser();

  expect(await saveAvatar(user.id, await image("png", { size: MAX_AVATAR_BYTES + 1 }))).toEqual({ error: "tooLarge" });
  expect(await getAvatarVersion(user.id)).toBeNull();
});

test.each([
  ["a GIF", signatureOnly([...Buffer.from("GIF89a")], "image/gif")],
  ["text renamed to .png", new File(["<script>alert(1)</script>"], "photo.png", { type: "image/png" })],
  ["a PNG signature with nothing after", signatureOnly([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image/png")],
])("Should_RefuseWithoutSaving_When_FileIs_%s", async (_name, file) => {
  const user = await newUser();

  expect(await saveAvatar(user.id, file)).toEqual({ error: "type" });
  expect(await getAvatarVersion(user.id)).toBeNull();
});

test("Should_AcceptPhoto_When_BrowserAnnouncesAnotherType", async () => {
  const user = await newUser();

  expect(await saveAvatar(user.id, await image("webp", { type: "image/png" }))).toEqual({});
});

test("Should_ServeNewPhotoAndChangeVersion_When_PhotoIsReplaced", async () => {
  const user = await newUser();
  await saveAvatar(user.id, await image("png", { color: "#000000" }));
  const first = await getAvatarImage(user.id);
  const firstVersion = await getAvatarVersion(user.id);

  await saveAvatar(user.id, await image("jpeg", { color: "#ffffff" }));

  expect((await getAvatarImage(user.id))?.body).not.toEqual(first?.body);
  expect(await getAvatarVersion(user.id)).not.toBe(firstVersion);
  expect(await db.select().from(avatars).where(inArray(avatars.userId, [user.id]))).toHaveLength(1);
});

test("Should_ServeInitials_When_PhotoIsRemoved", async () => {
  const user = await newUser("alex_martin");
  await saveAvatar(user.id, await image("png"));

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
  await saveAvatar(user.id, await image("png"));

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
