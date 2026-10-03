// @vitest-environment node
import { afterAll, beforeAll, expect, test } from "vitest";
import { like } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";
import { users } from "../db/schema";
import { MAX_P95_MS, runLoadTest } from "../scripts/load-test";

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "db/migrations" });
});

afterAll(async () => {
  await db.$client.end();
});

// Petite version du test de charge : 10 participants, 5 frappes chacun.
test("Should_DeliverEveryKeystrokeToEveryClient_When_RaceRuns", async () => {
  const stats = await runLoadTest({ participants: 10, typingMs: 1000 });

  expect(stats.participants).toBe(10);
  expect(stats.samples).toBe(10 * 10 * 5);
  expect(stats.p95).toBeLessThan(MAX_P95_MS);
}, 30_000);

test("Should_DeleteTemporaryUsers_When_Done", async () => {
  await runLoadTest({ participants: 3, typingMs: 400 });

  expect(await db.select().from(users).where(like(users.username, "load\\_%"))).toEqual([]);
}, 30_000);
