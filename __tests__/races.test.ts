// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";
import { lobbies, races, texts, users } from "../db/schema";
import { createLobby } from "../lib/lobbies";
import { createRace, markRaceEnded, markRaceStarted } from "../lib/races";
import { applyTextOptions, cutText } from "../lib/texts";

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

test.each(["easy", "medium", "hard"] as const)(
  "Should_PickTextOfLobbyComplexity_When_ComplexityIs_%s",
  async (textComplexity) => {
    const race = await createRace(await newLobby({ textComplexity }));

    const [source] = await db.select().from(texts).where(eq(texts.id, race!.textId!));
    expect(source.complexity).toBe(textComplexity);
  },
);

test("Should_RemoveUntickedContent_When_LobbyTurnsOptionsOff", async () => {
  const lobby = await newLobby({
    textLanguage: "fr",
    textLength: 50,
    textComplexity: "hard",
    textPunctuation: false,
    textNumbers: false,
    textCapitals: false,
    textAccents: false,
  });

  const race = await createRace(lobby);

  const [source] = await db.select().from(texts).where(eq(texts.id, race!.textId!));
  expect(race!.content).toBe(
    applyTextOptions(cutText(source.content, 50), {
      punctuation: false,
      numbers: false,
      capitals: false,
      accents: false,
    }),
  );
  expect(race!.content).toMatch(/^[a-z' -]+$/);
});

test("Should_UseHostText_When_LobbyHasCustomText", async () => {
  const race = await createRace(await newLobby({ customText: "Mon texte à moi.", textType: "words" }));

  expect(race).toMatchObject({ textId: null, content: "Mon texte à moi." });
});

test("Should_UseScrambledWords_When_LobbyTextTypeIsWords", async () => {
  const lobby = await newLobby({ textType: "words", textLength: 50, textTargets: ["digits"] });

  const race = await createRace(lobby);

  expect(race!.textId).toBeNull();
  expect(race!.content.split(" ")).toHaveLength(50);
});

test.each(["blocking", "tolerant"] as const)(
  "Should_CopyLobbyErrorMode_When_LobbyIs_%s",
  async (errorMode) => {
    const race = await createRace(await newLobby({ errorMode }));

    expect(race!.errorMode).toBe(errorMode);
  },
);

test.each([true, false])("Should_CopyLobbyBonuses_When_BonusesEnabledIs_%s", async (bonusesEnabled) => {
  const race = await createRace(await newLobby({ bonusesEnabled }));

  expect(race!.bonusesEnabled).toBe(bonusesEnabled);
});

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

test.each([
  ["a timer", 600],
  ["no timer", null],
])("Should_CopyLobbyTimer_When_LobbyHas_%s", async (_, timeLimitSeconds) => {
  const race = await createRace(await newLobby({ timeLimitSeconds }));

  expect(race!.timeLimitSeconds).toBe(timeLimitSeconds);
});

test("Should_SetEndTime_When_RaceEnds", async () => {
  const race = await createRace(await newLobby());
  const before = Date.now();

  await markRaceEnded(race!.id);

  const [saved] = await db.select().from(races).where(eq(races.id, race!.id));
  expect(saved.endedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
});
