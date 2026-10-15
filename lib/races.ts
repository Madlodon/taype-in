// Courses d'un lobby : le texte et la minuterie sont copiés au départ, le « Go » et la fin sont datés (CRS-1, CRS-4).
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { races } from "../db/schema.ts";
import type { Lobby } from "./lobbies.ts";
import { pickText, pickWords, type TextTarget } from "./texts.ts";

export type Race = typeof races.$inferSelect;

// Texte de l'hôte, mots mélangés ou texte de la banque selon les réglages du lobby (TXT-4 à TXT-6).
// La complexité et les options du texte s'appliquent aux phrases de la banque (CONF-05, CONF-06).
async function raceText(lobby: Lobby): Promise<{ textId: string | null; content: string } | null> {
  if (lobby.customText) return { textId: null, content: lobby.customText };
  if (lobby.textType === "sentences") {
    return pickText(lobby.textLanguage, lobby.textLength, lobby.textComplexity, {
      punctuation: lobby.textPunctuation,
      numbers: lobby.textNumbers,
      capitals: lobby.textCapitals,
      accents: lobby.textAccents,
    });
  }
  const targets = lobby.textTargets as TextTarget[];
  const content = await pickWords(lobby.textLanguage, lobby.textLength, targets, lobby.textLetters);
  return content === null ? null : { textId: null, content };
}

// Tire un texte selon les réglages du lobby ; null si la banque n'a aucun texte correspondant.
export async function createRace(lobby: Lobby): Promise<Race | null> {
  const text = await raceText(lobby);
  if (!text) return null;
  const [race] = await db
    .insert(races)
    .values({
      lobbyId: lobby.id,
      textId: text.textId,
      content: text.content,
      language: lobby.textLanguage,
      timeLimitSeconds: lobby.timeLimitSeconds,
      errorMode: lobby.errorMode,
    })
    .returning();
  return race;
}

export async function markRaceStarted(raceId: string) {
  await db.update(races).set({ startedAt: new Date() }).where(eq(races.id, raceId));
}

export async function markRaceEnded(raceId: string) {
  await db.update(races).set({ endedAt: new Date() }).where(eq(races.id, raceId));
}
