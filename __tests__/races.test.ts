// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";
import { lobbies, races, texts, users } from "../db/schema";
import { createLobby } from "../lib/lobbies";
import { createRace, markRaceStarted } from "../lib/races";
import { cutText } from "../lib/texts";

// Utilisateurs créés par un test, supprimés après (avec leurs lobbys et courses).
const createdIds: string[] = [];

async function newLobby(text?: Parameters<typeof createLobby>[2]) {
  const [user] = await db
    .insert(users)
    .values({ username: `t_${Math.random().toString(36).slice(2, 12)}` })
    .returning();
  createdIds.push(user.id);
  return createLobby(user.id, "unlisted", text);
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "db/migrations" });
});

afterEach(async () => {
  if (createdIds.length === 0) return;
  const ids = createdIds.splice(0);
  await db.delete(lobbies).where(inArray(lobbies.hostId, ids));
  await db.delete(users).where(inArray(users.id, ids));
});

afterAll(async () => {
  await db.$client.end();
});

test.each([
  ["fr", 50],
  ["en", 200],
] as const)(
  "Should_CopyBankTextCutToLobbySettings_When_LobbyIs_%s_%i",
  async (textLanguage, textLength) => {
    const lobby = await newLobby({ textLanguage, textLength });

    const race = await createRace(lobby);

    const [source] = await db.select().from(texts).where(eq(texts.id, race!.textId!));
    expect(race).toMatchObject({ lobbyId: lobby.id, language: textLanguage, startedAt: null });
    expect(source.language).toBe(textLanguage);
    expect(race!.content).toBe(cutText(source.content, textLength));
  },
);

test.each(["blocking", "tolerant"] as const)(
  "Should_CopyLobbyErrorMode_When_LobbyIs_%s",
  async (errorMode) => {
    const race = await createRace(await newLobby({ errorMode }));

    expect(race!.errorMode).toBe(errorMode);
  },
);

test("Should_SaveRace_When_Created", async () => {
  const race = await createRace(await newLobby());

  const [saved] = await db.select().from(races).where(eq(races.id, race!.id));
  expect(saved.content).toBe(race!.content);
});

test("Should_SetStartTime_When_RaceStarts", async () => {
  const race = await createRace(await newLobby());
  const before = Date.now();

  await markRaceStarted(race!.id);

  const [saved] = await db.select().from(races).where(eq(races.id, race!.id));
  expect(saved.startedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
});
