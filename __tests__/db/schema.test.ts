// @vitest-environment node
import { afterAll, beforeAll, expect, test } from "vitest";
import { eq, TransactionRollbackError } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../../db";
import {
  lobbies,
  lobbyParticipants,
  races,
  results,
  sessions,
  texts,
  users,
} from "../../db/schema";

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

async function createLobby(tx: Tx, code = "ABC123") {
  const [host] = await tx.insert(users).values({ username: "hote" }).returning();
  const [lobby] = await tx
    .insert(lobbies)
    .values({ code, visibility: "unlisted", hostId: host.id })
    .returning();
  return { host, lobby };
}

async function createRace(tx: Tx, lobbyId: string) {
  const [race] = await tx
    .insert(races)
    .values({
      lobbyId,
      content: "Le chat dort.",
      language: "fr",
      errorMode: "blocking",
    })
    .returning();
  return race;
}

const aResult = {
  rank: 1,
  wpm: 42.5,
  accuracy: 97.3,
  durationMs: 30_000,
  errorCount: 2,
  finished: true,
};

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

test("Should_RejectLobby_When_CodeIsAlreadyUsed", async () => {
  await inRolledBackTransaction(async (tx) => {
    const { host } = await createLobby(tx, "ZZZ999");

    await expect(
      tx
        .insert(lobbies)
        .values({ code: "ZZZ999", visibility: "public", hostId: host.id }),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
  });
});

test("Should_RejectParticipant_When_UserAlreadyJoinedTheLobby", async () => {
  await inRolledBackTransaction(async (tx) => {
    const { host, lobby } = await createLobby(tx);
    await tx
      .insert(lobbyParticipants)
      .values({ lobbyId: lobby.id, userId: host.id });

    await expect(
      tx
        .insert(lobbyParticipants)
        .values({ lobbyId: lobby.id, userId: host.id }),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
  });
});

test("Should_RejectParticipant_When_UserIsAlreadyInAnotherLobby", async () => {
  await inRolledBackTransaction(async (tx) => {
    const { host, lobby } = await createLobby(tx);
    const [other] = await tx
      .insert(lobbies)
      .values({ code: "OTHER2", visibility: "public", hostId: host.id })
      .returning();
    await tx
      .insert(lobbyParticipants)
      .values({ lobbyId: lobby.id, userId: host.id });

    await expect(
      tx
        .insert(lobbyParticipants)
        .values({ lobbyId: other.id, userId: host.id }),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
  });
});

test("Should_ApplyDefaults_When_RaceIsCreatedWithRequiredSettingsOnly", async () => {
  await inRolledBackTransaction(async (tx) => {
    const { lobby } = await createLobby(tx);

    const race = await createRace(tx, lobby.id);

    expect(race).toMatchObject({
      textId: null,
      timeLimitSeconds: null,
      bonusesEnabled: false,
      startedAt: null,
      endedAt: null,
    });
  });
});

test("Should_KeepRaceContent_When_SourceTextIsDeleted", async () => {
  await inRolledBackTransaction(async (tx) => {
    const { lobby } = await createLobby(tx);
    const [source] = await tx
      .insert(texts)
      .values({ language: "fr", title: "Chat", content: "Le chat dort." })
      .returning();
    const [race] = await tx
      .insert(races)
      .values({
        lobbyId: lobby.id,
        textId: source.id,
        content: source.content,
        language: "fr",
        errorMode: "tolerant",
      })
      .returning();

    await tx.delete(texts).where(eq(texts.id, source.id));

    const [after] = await tx.select().from(races).where(eq(races.id, race.id));
    expect(after).toMatchObject({ textId: null, content: "Le chat dort." });
  });
});

test("Should_DeleteRacesResultsAndParticipants_When_LobbyIsDeleted", async () => {
  await inRolledBackTransaction(async (tx) => {
    const { host, lobby } = await createLobby(tx);
    await tx
      .insert(lobbyParticipants)
      .values({ lobbyId: lobby.id, userId: host.id });
    const race = await createRace(tx, lobby.id);
    await tx
      .insert(results)
      .values({ ...aResult, raceId: race.id, userId: host.id });

    await tx.delete(lobbies).where(eq(lobbies.id, lobby.id));

    expect(
      await tx.select().from(races).where(eq(races.lobbyId, lobby.id)),
    ).toHaveLength(0);
    expect(
      await tx.select().from(results).where(eq(results.raceId, race.id)),
    ).toHaveLength(0);
    expect(
      await tx
        .select()
        .from(lobbyParticipants)
        .where(eq(lobbyParticipants.lobbyId, lobby.id)),
    ).toHaveLength(0);
  });
});

test("Should_RejectHostDeletion_When_UserHostsALobby", async () => {
  await inRolledBackTransaction(async (tx) => {
    const { host } = await createLobby(tx);

    await expect(
      tx.delete(users).where(eq(users.id, host.id)),
    ).rejects.toMatchObject({ cause: { code: "23503" } });
  });
});

test("Should_StoreKeyErrors_When_ResultIsSaved", async () => {
  await inRolledBackTransaction(async (tx) => {
    const { host, lobby } = await createLobby(tx);
    const race = await createRace(tx, lobby.id);

    const [result] = await tx
      .insert(results)
      .values({
        ...aResult,
        raceId: race.id,
        userId: host.id,
        keyErrors: { é: 3, z: 1 },
      })
      .returning();

    expect(result.keyErrors).toEqual({ é: 3, z: 1 });
  });
});

test("Should_DefaultKeyErrorsToEmpty_When_NoneAreGiven", async () => {
  await inRolledBackTransaction(async (tx) => {
    const { host, lobby } = await createLobby(tx);
    const race = await createRace(tx, lobby.id);

    const [result] = await tx
      .insert(results)
      .values({ ...aResult, raceId: race.id, userId: host.id })
      .returning();

    expect(result.keyErrors).toEqual({});
  });
});

test("Should_RejectResult_When_UserAlreadyHasOneForTheRace", async () => {
  await inRolledBackTransaction(async (tx) => {
    const { host, lobby } = await createLobby(tx);
    const race = await createRace(tx, lobby.id);
    await tx
      .insert(results)
      .values({ ...aResult, raceId: race.id, userId: host.id });

    await expect(
      tx.insert(results).values({ ...aResult, raceId: race.id, userId: host.id }),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
  });
});

test.each([
  ["rank is 0", { rank: 0 }],
  ["accuracy is negative", { accuracy: -0.1 }],
  ["accuracy is above 100", { accuracy: 100.1 }],
])("Should_RejectResult_When_%s", async (_label, override) => {
  await inRolledBackTransaction(async (tx) => {
    const { host, lobby } = await createLobby(tx);
    const race = await createRace(tx, lobby.id);

    await expect(
      tx
        .insert(results)
        .values({ ...aResult, ...override, raceId: race.id, userId: host.id }),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  });
});

test("Should_AcceptResult_When_AccuracyIsAtBounds", async () => {
  await inRolledBackTransaction(async (tx) => {
    const { host, lobby } = await createLobby(tx);
    const [other] = await tx.insert(users).values({ username: "sam" }).returning();
    const race = await createRace(tx, lobby.id);

    await tx.insert(results).values([
      { ...aResult, accuracy: 0, raceId: race.id, userId: host.id },
      { ...aResult, rank: 2, accuracy: 100, raceId: race.id, userId: other.id },
    ]);

    expect(
      await tx.select().from(results).where(eq(results.raceId, race.id)),
    ).toHaveLength(2);
  });
});
