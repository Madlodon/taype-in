// Courses d'un lobby : le texte est copié au départ, le « Go » est daté (CRS-1).
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { races } from "../db/schema.ts";
import type { Lobby } from "./lobbies.ts";
import { pickText } from "./texts.ts";

export type Race = typeof races.$inferSelect;

// Tire un texte selon les réglages du lobby ; null si la banque n'a aucun texte dans cette langue.
export async function createRace(lobby: Lobby): Promise<Race | null> {
  const text = await pickText(lobby.textLanguage, lobby.textLength);
  if (!text) return null;
  const [race] = await db
    .insert(races)
    .values({
      lobbyId: lobby.id,
      textId: text.textId,
      content: text.content,
      language: lobby.textLanguage,
      // L'hôte choisira le mode d'erreur avec l'interface de frappe (#56).
      errorMode: "blocking",
    })
    .returning();
  return race;
}

export async function markRaceStarted(raceId: string) {
  await db.update(races).set({ startedAt: new Date() }).where(eq(races.id, raceId));
}
