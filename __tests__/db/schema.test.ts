// @vitest-environment node
import { afterAll, beforeAll, expect, test } from "vitest";
import { eq, TransactionRollbackError } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../../db";
import { sessions, users } from "../../db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Chaque test roule dans une transaction annulée pour ne pas salir la base de dev.
async function inRolledBackTransaction(fn: (tx: Tx) => Promise<void>) {
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      tx.rollback();
    });
  } catch (error) {
    if (!(error instanceof TransactionRollbackError)) throw error;
  }
}

function inOneHour() {
  return new Date(Date.now() + 60 * 60 * 1000);
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "db/migrations" });
});

afterAll(async () => {
  await db.$client.end();
});

test("Should_ApplyDefaults_When_UserIsCreatedWithOnlyAUsername", async () => {
  await inRolledBackTransaction(async (tx) => {
    const [user] = await tx.insert(users).values({ username: "alex" }).returning();

    expect(user).toMatchObject({
      username: "alex",
      passwordHash: null,
      isGuest: false,
    });
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.createdAt).toBeInstanceOf(Date);
  });
});

test("Should_RejectUser_When_UsernameExistsWithDifferentCase", async () => {
  await inRolledBackTransaction(async (tx) => {
    await tx.insert(users).values({ username: "Alex" });

    await expect(
      tx.insert(users).values({ username: "aLEX" }),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
  });
});

test("Should_RejectSession_When_UserDoesNotExist", async () => {
  await inRolledBackTransaction(async (tx) => {
    await expect(
      tx.insert(sessions).values({
        id: "session-orpheline",
        userId: "00000000-0000-0000-0000-000000000000",
        expiresAt: inOneHour(),
      }),
    ).rejects.toMatchObject({ cause: { code: "23503" } });
  });
});

test("Should_DeleteSessions_When_UserIsDeleted", async () => {
  await inRolledBackTransaction(async (tx) => {
    const [user] = await tx.insert(users).values({ username: "sam" }).returning();
    await tx
      .insert(sessions)
      .values({ id: "session-sam", userId: user.id, expiresAt: inOneHour() });

    await tx.delete(users).where(eq(users.id, user.id));

    const remaining = await tx
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id));
    expect(remaining).toHaveLength(0);
  });
});
