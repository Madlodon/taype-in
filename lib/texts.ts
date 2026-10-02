// Choix d'un texte de la banque selon la langue et la longueur (TXT-1 à TXT-3).
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { texts } from "../db/schema.ts";

export type TextLanguage = (typeof texts.$inferSelect)["language"];

// Nombre de mots proposés à l'hôte.
export const TEXT_LENGTHS = [50, 100, 200] as const;
export type TextLength = (typeof TEXT_LENGTHS)[number];

// Garde les phrases entières jusqu'à atteindre le nombre de mots voulu.
export function cutText(content: string, words: number): string {
  let count = 0;
  for (const match of content.matchAll(/[^.!?]*[.!?]+(?=\s|$)/g)) {
    count += match[0].split(/\s+/).filter(Boolean).length;
    if (count >= words) return content.slice(0, match.index + match[0].length).trim();
  }
  return content.trim();
}

// Texte tiré au hasard dans la langue voulue, déjà coupé ; null si la banque est vide.
export async function pickText(
  language: TextLanguage,
  words: number,
): Promise<{ textId: string; content: string } | null> {
  const [text] = await db
    .select()
    .from(texts)
    .where(eq(texts.language, language))
    .orderBy(sql`random()`)
    .limit(1);
  if (!text) return null;
  return { textId: text.id, content: cutText(text.content, words) };
}
