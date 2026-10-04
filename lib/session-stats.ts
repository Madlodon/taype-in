// Statistiques de la session de courses en cours (PROF-5), invités compris :
// les courses d'affilée, sans pause de plus de 30 min entre deux fins de course.
import { computeStats, listRaceHistory, type HistoryEntry, type ProfileStats } from "./profile.ts";

export const SESSION_GAP_MS = 30 * 60 * 1000;

export type SessionStats = Omit<ProfileStats, "hardestKeys"> & { races: number };

// history va de la plus récente à la plus ancienne ; une session finie depuis 30 min ne compte plus.
export function currentSession(history: HistoryEntry[], now: number): HistoryEntry[] {
  let previous = now;
  let count = 0;
  for (const entry of history) {
    if (previous - entry.date.getTime() > SESSION_GAP_MS) break;
    previous = entry.date.getTime();
    count++;
  }
  return history.slice(0, count);
}

export async function getSessionStats(userId: string, now = Date.now()): Promise<SessionStats> {
  const session = currentSession(await listRaceHistory(userId), now);
  const { bestWpm, averageWpm, averageAccuracy } = computeStats(session);
  return { races: session.length, bestWpm, averageWpm, averageAccuracy };
}
