// Choix d'un texte de la banque selon la langue et la longueur (TXT-1 à TXT-3),
// ou mots mélangés avec caractères ciblés (TXT-4, TXT-5).
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { texts } from "../db/schema.ts";

export type TextLanguage = (typeof texts.$inferSelect)["language"];

// Nombre de mots proposés à l'hôte.
export const TEXT_LENGTHS = [50, 100, 200] as const;
export type TextLength = (typeof TEXT_LENGTHS)[number];

// Caractères que l'hôte peut cibler en mode mots mélangés.
export const TEXT_TARGETS = ["accents", "cedilla", "comma", "apostrophe", "digits", "special"] as const;
export type TextTarget = (typeof TEXT_TARGETS)[number];
export const MAX_CUSTOM_TEXT = 2000;
const SPECIAL_CHARACTERS = [..."@#$%&*+=/?!"];

// Lettres ciblées : seulement des lettres, en minuscules, sans doublon.
export function normalizeLetters(input: string): string {
  return [...new Set(input.toLowerCase().match(/\p{L}/gu) ?? [])].join("");
}

// Mots de la banque, en minuscules et sans ponctuation autour, sans doublon.
export function toDictionary(contents: string[]): string[] {
  const words = contents.flatMap((content) =>
    content.toLowerCase().split(/\s+/).map((word) => word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "")),
  );
  return [...new Set(words.filter(Boolean))];
}

// Le mot contient-il un des caractères ciblés ?
function isTargeted(word: string, targets: readonly TextTarget[], letters: string): boolean {
  return (
    (targets.includes("accents") && /[àâäéèêëîïôöùûüÿœæ]/.test(word))
    || (targets.includes("cedilla") && word.includes("ç"))
    || (targets.includes("apostrophe") && word.includes("'"))
    || [...letters].some((letter) => word.includes(letter))
  );
}

// count mots tirés au hasard ; environ la moitié contient un caractère ciblé.
// Virgules après certains mots, nombres et caractères spéciaux ajoutés comme des mots.
export function scrambleWords(
  dictionary: string[],
  count: number,
  targets: readonly TextTarget[],
  letters: string,
  random: () => number = Math.random,
): string {
  if (dictionary.length === 0) return "";
  const pick = (items: string[]) => items[Math.floor(random() * items.length)];
  const targeted = dictionary.filter((word) => isTargeted(word, targets, letters));
  const words: string[] = [];
  while (words.length < count) {
    let word: string;
    if (targets.includes("digits") && random() < 0.15) word = String(Math.floor(random() * 1000));
    else if (targets.includes("special") && random() < 0.15) word = pick(SPECIAL_CHARACTERS);
    else word = pick(targeted.length > 0 && random() < 0.5 ? targeted : dictionary);
    if (targets.includes("comma") && words.length < count - 1 && random() < 0.2) word += ",";
    words.push(word);
  }
  return words.join(" ");
}

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

// Mots mélangés tirés de toute la banque de cette langue ; null si elle est vide.
export async function pickWords(
  language: TextLanguage,
  words: number,
  targets: readonly TextTarget[],
  letters: string,
): Promise<string | null> {
  const bank = await db.select({ content: texts.content }).from(texts).where(eq(texts.language, language));
  const dictionary = toDictionary(bank.map((text) => text.content));
  return dictionary.length === 0 ? null : scrambleWords(dictionary, words, targets, letters);
}
