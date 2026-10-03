// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";
import { users } from "../db/schema";
import { getLoadout, saveLoadout } from "../lib/garage";
import { BOOSTS, HATS, DEFAULT_LOADOUT, loadoutSchema } from "../lib/garage-items";

const createdIds: string[] = [];

async function newUser() {
  const [user] = await db
    .insert(users)
    .values({ username: `t_${Math.random().toString(36).slice(2, 12)}` })
    .returning();
  createdIds.push(user.id);
  return user;
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

test("Should_GiveOctaneWithStandardBoostAndNoHatOrBall_When_UserIsNew", async () => {
  const user = await newUser();

  expect(await getLoadout(user.id)).toEqual({ car: "octane", boost: "standard", hat: "none", ball: "none" });
});

test("Should_ReturnSavedChoice_When_LoadoutWasSaved", async () => {
  const user = await newUser();
  const loadout = { car: "fennec", boost: "flames", hat: "cone", ball: "beach" } as const;

  await saveLoadout(user.id, loadout);

  expect(await getLoadout(user.id)).toEqual(loadout);
});

test("Should_FallBackToDefault_When_StoredItemNoLongerExists", async () => {
  const user = await newUser();
  await db.update(users).set({ car: "breakout", hat: "crown" }).where(eq(users.id, user.id));

  expect(await getLoadout(user.id)).toEqual(DEFAULT_LOADOUT);
});

test("Should_AcceptNoneForHatAndBall_When_Parsing", () => {
  expect(loadoutSchema.safeParse({ car: "merc", boost: "standard", hat: "none", ball: "none" }).success).toBe(true);
});

test.each([
  ["no boost", { car: "octane", boost: "none", hat: "none", ball: "none" }],
  ["missing boost", { car: "octane", hat: "none", ball: "none" }],
  ["unknown car", { car: "breakout", boost: "standard", hat: "none", ball: "none" }],
  ["unknown hat", { car: "octane", boost: "standard", hat: "crown", ball: "none" }],
])("Should_Reject_When_%s", (_name, value) => {
  expect(loadoutSchema.safeParse(value).success).toBe(false);
});

test.each(BOOSTS)("Should_ReturnSavedBoost_When_Saving_%s", async (boost) => {
  const user = await newUser();
  const loadout = { ...DEFAULT_LOADOUT, boost };
  await saveLoadout(user.id, loadout);
  expect(await getLoadout(user.id)).toEqual(loadout);
});

test.each(HATS)("Should_ReturnSavedHat_When_Saving_%s", async (hat) => {
  const user = await newUser();
  const loadout = { ...DEFAULT_LOADOUT, hat };
  expect(loadoutSchema.safeParse(loadout).success).toBe(true);
  await saveLoadout(user.id, loadout);
  expect(await getLoadout(user.id)).toEqual(loadout);
});
