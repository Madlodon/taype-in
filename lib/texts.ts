// Choix d'un texte de la banque selon la langue, la longueur et la complexité (TXT-1 à TXT-3, CONF-04 à CONF-06),
// ou mots mélangés avec caractères ciblés (TXT-4, TXT-5).
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { texts } from "../db/schema.ts";

export type TextLanguage = (typeof texts.$inferSelect)["language"];
export type TextComplexity = (typeof texts.$inferSelect)["complexity"];

// Nombre de mots proposés à l'hôte.
export const TEXT_LENGTHS = [50, 100, 200] as const;
export type TextLength = (typeof TEXT_LENGTHS)[number];

export const COMPLEXITIES = ["easy", "medium", "hard"] as const satisfies readonly TextComplexity[];

// CONF-06 : contenu gardé (true) ou retiré (false) du texte tiré.
export type TextOptions = {
  punctuation: boolean;
  numbers: boolean;
  capitals: boolean;
  accents: boolean;
};

export const ALL_TEXT_OPTIONS: TextOptions = {
  punctuation: true,
  numbers: true,
  capitals: true,
  accents: true,
};

// CONF-05 : seuils de longueur moyenne des mots (en lettres), par langue,
// car les mots français sont naturellement plus longs que les mots anglais.
const WORD_LENGTH_THRESHOLDS: Record<TextLanguage, { easy: number; hard: number }> = {
  fr: { easy: 4.7, hard: 5.5 },
  en: { easy: 4.3, hard: 5.2 },
};
// Caractères spéciaux pour 100 mots : tout sauf lettres, espaces, point, virgule et apostrophe.
const EASY_MAX_SPECIAL = 2;
const HARD_MIN_SPECIAL = 8;

export function measureText(content: string): { wordLength: number; specialPer100: number } {
  const words = content.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { wordLength: 0, specialPer100: 0 };
  const letters = content.match(/\p{L}/gu)?.length ?? 0;
  const special = content.match(/[^\p{L}\s.,'’]/gu)?.length ?? 0;
  return { wordLength: letters / words.length, specialPer100: (special / words.length) * 100 };
}

// Difficile si un critère est élevé ; facile si les deux sont bas ; moyen sinon.
export function textComplexity(content: string, language: TextLanguage): TextComplexity {
  const { wordLength, specialPer100 } = measureText(content);
  const thresholds = WORD_LENGTH_THRESHOLDS[language];
  if (wordLength >= thresholds.hard || specialPer100 >= HARD_MIN_SPECIAL) return "hard";
  if (wordLength < thresholds.easy && specialPer100 <= EASY_MAX_SPECIAL) return "easy";
  return "medium";
}

// Retire le contenu des options désactivées. L'apostrophe et le trait d'union
// à l'intérieur d'un mot en font partie (« l'école », « peut-être ») et restent.
export function applyTextOptions(content: string, options: TextOptions): string {
  let result = content;
  // Le mot entier part avec ses chiffres (« 8h30 », « 2e »).
  if (!options.numbers) result = result.replace(/\S*\d\S*/g, "");
  if (!options.punctuation) {
    result = result.replace(/(?<!\p{L})['’-]|['’-](?!\p{L})|[^\p{L}\p{N}\s'’-]/gu, "");
  }
  if (!options.capitals) result = result.toLowerCase();
  if (!options.accents) {
    result = result
      .replace(/œ/g, "oe").replace(/Œ/g, "OE").replace(/æ/g, "ae").replace(/Æ/g, "AE")
      .normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");
  }
  return result.replace(/\s+/g, " ").trim();
}

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

// Texte tiré au hasard dans la langue et la complexité voulues, coupé puis
// filtré selon les options ; null si la banque n'a aucun texte correspondant.
export async function pickText(
  language: TextLanguage,
  words: number,
  complexity: TextComplexity = "medium",
  options: TextOptions = ALL_TEXT_OPTIONS,
): Promise<{ textId: string; content: string } | null> {
  const [text] = await db
    .select()
    .from(texts)
    .where(and(eq(texts.language, language), eq(texts.complexity, complexity)))
    .orderBy(sql`random()`)
    .limit(1);
  if (!text) return null;
  return { textId: text.id, content: applyTextOptions(cutText(text.content, words), options) };
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
