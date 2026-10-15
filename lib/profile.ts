// Profil public d'un utilisateur inscrit : historique des courses (PROF-2) et statistiques globales (PROF-3).
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { races, results, texts, users } from "../db/schema.ts";
import type { User } from "./auth.ts";

export type HistoryEntry = {
  raceId: string;
  date: Date;
  // Titre du texte de la banque ; null pour un texte écrit par l'hôte.
  textTitle: string | null;
  content: string;
  rank: number;
  wpm: number;
  accuracy: number;
  finished: boolean;
  bonusesEnabled: boolean;
  keyErrors: Record<string, number>;
};

export type ProfileStats = {
  bestWpm: number | null;
  averageWpm: number | null;
  averageAccuracy: number | null;
  // Courses terminées à la première place (AUTH-06).
  wins: number;
  hardestKeys: { key: string; errors: number }[];
};

export const HARDEST_KEYS_COUNT = 5;

// Titre du texte de la banque, sinon ses premiers mots : un texte écrit par l'hôte n'a pas de titre.
export function textLabel(textTitle: string | null, content: string): string {
  if (textTitle !== null) return textTitle;
  const words = content.split(/\s+/);
  return words.length > 6 ? `${words.slice(0, 6).join(" ")}…` : content;
}

// Les invités n'ont pas de profil.
export async function findProfileUser(username: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(sql`lower(${users.username})`, username.toLowerCase()), eq(users.isGuest, false)));
  return user ?? null;
}

// Toutes les courses de l'utilisateur, de la plus récente à la plus ancienne.
export async function listRaceHistory(userId: string): Promise<HistoryEntry[]> {
  const date = sql<Date>`coalesce(${races.endedAt}, ${races.createdAt})`.mapWith(races.createdAt);
  return db
    .select({
      raceId: races.id,
      date,
      textTitle: texts.title,
      content: races.content,
      rank: results.rank,
      wpm: results.wpm,
      accuracy: results.accuracy,
      finished: results.finished,
      bonusesEnabled: races.bonusesEnabled,
      keyErrors: results.keyErrors,
    })
    .from(results)
    .innerJoin(races, eq(races.id, results.raceId))
    .leftJoin(texts, eq(texts.id, races.textId))
    .where(eq(results.userId, userId))
    .orderBy(desc(date));
}

function average(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

// Vitesses et précision sur les courses terminées ; les bonus faussent les vitesses.
// Les touches difficiles comptent les fautes de toutes les courses.
export function computeStats(history: HistoryEntry[]): ProfileStats {
  const finished = history.filter((entry) => entry.finished);
  const fair = finished.filter((entry) => !entry.bonusesEnabled).map((entry) => entry.wpm);
  const errorsByKey = new Map<string, number>();
  for (const entry of history) {
    for (const [key, errors] of Object.entries(entry.keyErrors)) {
      errorsByKey.set(key, (errorsByKey.get(key) ?? 0) + errors);
    }
  }
  return {
    bestWpm: fair.length === 0 ? null : Math.max(...fair),
    averageWpm: average(fair),
    averageAccuracy: average(finished.map((entry) => entry.accuracy)),
    wins: finished.filter((entry) => entry.rank === 1).length,
    hardestKeys: [...errorsByKey]
      .filter(([, errors]) => errors > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, HARDEST_KEYS_COUNT)
      .map(([key, errors]) => ({ key, errors })),
  };
}

export type ProgressionPoint = { date: Date; wpm: number; accuracy: number };

export const PROGRESSION_RACES = 30;

// Points du graphique de progression (PROF-4), de la plus ancienne à la plus récente.
// Mêmes courses que les vitesses : terminées et sans bonus.
export function progressionPoints(history: HistoryEntry[]): ProgressionPoint[] {
  return history
    .filter((entry) => entry.finished && !entry.bonusesEnabled)
    .slice(0, PROGRESSION_RACES)
    .reverse()
    .map(({ date, wpm, accuracy }) => ({ date, wpm, accuracy }));
}

export const HISTORY_PAGE_SIZE = 10;

export type HistoryPage = { entries: HistoryEntry[]; page: number; pageCount: number };

// Une page de l'historique (HIST-01) ; une page invalide ou hors limites donne la plus proche.
export function paginateHistory(history: HistoryEntry[], page: number): HistoryPage {
  const pageCount = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE));
  const current = Number.isInteger(page) ? Math.min(Math.max(page, 1), pageCount) : 1;
  const start = (current - 1) * HISTORY_PAGE_SIZE;
  return { entries: history.slice(start, start + HISTORY_PAGE_SIZE), page: current, pageCount };
}
