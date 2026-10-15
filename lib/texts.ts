// Choix d'un texte de la banque selon la langue, la longueur et la complexité (TXT-1 à TXT-3, CONF-04 à CONF-06).
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
