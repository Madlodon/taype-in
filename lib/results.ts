// Résultats d'une course : vitesse, précision, temps et classement (FIN-1, FIN-2, ERR-3),
// enregistrés dans l'historique des utilisateurs inscrits (FIN-4).
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.ts";
import { results, users } from "../db/schema.ts";
import type { ErrorMode } from "./typing.ts";
import type { ProgressMessage, RaceResult } from "./socket-messages.ts";

// Ce que le serveur sait d'un coureur à la fin ; reachedAt = moment où il a atteint sa position.
export type Racer = ProgressMessage & {
  id: string;
  username: string;
  finished: boolean;
  durationMs: number;
  reachedAt: number;
};

// Mode tolérant : chaque faute ajoute 1 s au temps (Q-7).
export const PENALTY_MS_PER_ERROR = 1000;

// Caractères tapés au bon endroit ; en mode tolérant, les fautes laissées ne comptent pas.
export function countCorrect(typed: string, content: string): number {
  let correct = 0;
  for (let index = 0; index < typed.length; index++) {
    if (typed[index] === content[index]) correct++;
  }
  return correct;
}

// MPM = (caractères corrects ÷ 5) ÷ minutes écoulées, soit caractères × 12 000 ÷ ms.
export function wordsPerMinute(correct: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return (correct * 12_000) / durationMs;
}

// Pourcentage de touches justes parmi toutes les touches pressées ; 0 si rien n'a été tapé.
export function accuracy(keys: number, errors: number): number {
  if (keys <= 0) return 0;
  return Math.max(0, ((keys - errors) / keys) * 100);
}

// Ordre d'arrivée (temps + pénalité) ; ceux qui n'ont pas fini, selon leur progression (Q-7).
export function rankRacers(racers: Racer[], content: string, errorMode: ErrorMode): RaceResult[] {
  const scored = racers.map((racer) => ({
    racer,
    penaltyMs: errorMode === "tolerant" ? racer.errors * PENALTY_MS_PER_ERROR : 0,
  }));
  scored.sort(
    (a, b) =>
      Number(b.racer.finished) - Number(a.racer.finished) ||
      (a.racer.finished
        ? a.racer.durationMs + a.penaltyMs - (b.racer.durationMs + b.penaltyMs)
        : b.racer.typed.length - a.racer.typed.length) ||
      a.racer.reachedAt - b.racer.reachedAt,
  );
  return scored.map(({ racer, penaltyMs }, index) => ({
    id: racer.id,
    username: racer.username,
    rank: index + 1,
    wpm: wordsPerMinute(countCorrect(racer.typed, content), racer.durationMs),
    accuracy: accuracy(racer.keys, racer.errors),
    durationMs: racer.durationMs,
    penaltyMs,
    errors: racer.errors,
    finished: racer.finished,
    keyErrors: racer.keyErrors,
  }));
}

// Seuls les inscrits gardent un historique ; les invités occupent quand même leur rang.
export async function saveResults(raceId: string, ranked: RaceResult[]) {
  if (ranked.length === 0) return;
  const registered = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, ranked.map((result) => result.id)), eq(users.isGuest, false)));
  const ids = new Set(registered.map((user) => user.id));
  const rows = ranked
    .filter((result) => ids.has(result.id))
    .map((result) => ({
      raceId,
      userId: result.id,
      rank: result.rank,
      wpm: result.wpm,
      accuracy: result.accuracy,
      durationMs: result.durationMs,
      errorCount: result.errors,
      finished: result.finished,
      keyErrors: result.keyErrors,
    }));
  if (rows.length > 0) await db.insert(results).values(rows);
}
