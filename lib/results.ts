import { withoutRemoved, type RemovedWord } from "./race-goals.ts";
// Résultats d'une course : vitesse, précision, temps et classement (FIN-1, FIN-2, ERR-3),
// enregistrés dans l'historique de chaque joueur, invités compris (FIN-4, PROF-5).
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { results, users } from "../db/schema.ts";
import { clampRankLevel, rankMoves } from "./ranks.ts";
import { accuracy, countCorrect, wordsPerMinute, type ErrorMode } from "./typing.ts";
import { raceXp } from "./xp.ts";
import type { ProgressMessage, RaceResult } from "./socket-messages.ts";

// Ce que le serveur sait d'un coureur à la fin ; reachedAt = moment où il a atteint sa position.
export type Racer = ProgressMessage & {
  id: string;
  username: string;
  finished: boolean;
  gaveUp: boolean;
  durationMs: number;
  reachedAt: number;
  removed?: RemovedWord[];
};

// Place d'un coureur avant la mise à jour des rangs (#99).
export type Placement = Omit<RaceResult, "rankLevel" | "rankChange" | "xp" | "xpGained">;

// Mode tolérant : chaque faute ajoute 1 s au temps (Q-7).
export const PENALTY_MS_PER_ERROR = 1000;

function statusOf(racer: Racer): RaceResult["status"] {
  if (racer.finished) return "finished";
  return racer.gaveUp ? "gaveUp" : "timeUp";
}

const STATUS_ORDER: RaceResult["status"][] = ["finished", "timeUp", "gaveUp"];

// Ceux qui ont fini, par temps + pénalité (Q-7) ; puis temps écoulé, puis abandons,
// chacun selon sa progression (à l'abandon pour ces derniers) (COURSE-10).
export function rankRacers(racers: Racer[], content: string, errorMode: ErrorMode): Placement[] {
  const scored = racers.map((racer) => ({
    racer,
    status: statusOf(racer),
    penaltyMs: errorMode === "tolerant" ? racer.errors * PENALTY_MS_PER_ERROR : 0,
  }));
  scored.sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
      (a.racer.finished
        ? a.racer.durationMs + a.penaltyMs - (b.racer.durationMs + b.penaltyMs)
        : b.racer.typed.length - a.racer.typed.length) ||
      a.racer.reachedAt - b.racer.reachedAt,
  );
  return scored.map(({ racer, status, penaltyMs }, index) => ({
    id: racer.id,
    username: racer.username,
    rank: index + 1,
    wpm: wordsPerMinute(countCorrect(withoutRemoved(racer.typed, racer.removed ?? []), withoutRemoved(content, racer.removed ?? [])), racer.durationMs),
    rawWpm: wordsPerMinute(racer.keys, racer.durationMs),
    accuracy: accuracy(racer.keys, racer.errors),
    durationMs: racer.durationMs,
    penaltyMs,
    errors: racer.errors,
    finished: racer.finished,
    status,
    bonuses: racer.removed?.length ?? 0,
    keyErrors: racer.keyErrors,
  }));
}

// Invités compris : leurs stats de session (PROF-5) les suivent s'ils s'inscrivent (AUTH-7).
export async function saveResults(raceId: string, ranked: Placement[]) {
  const rows = ranked.map((result) => ({
    raceId,
    userId: result.id,
    rank: result.rank,
    wpm: result.wpm,
    rawWpm: result.rawWpm,
    accuracy: result.accuracy,
    durationMs: result.durationMs,
    errorCount: result.errors,
    finished: result.finished,
    gaveUp: result.status === "gaveUp",
    bonuses: result.bonuses,
    keyErrors: result.keyErrors,
  }));
  if (rows.length > 0) await db.insert(results).values(rows);
}

export type RankUpdate = { rankLevel: number; rankChange: number };

// Applique la fin de course aux joueurs, dans l'ordre d'arrivée (invités compris).
// rankChange vaut 0 si le joueur est déjà au plancher ou au plafond.
export async function updateRanks(orderedIds: string[]): Promise<Map<string, RankUpdate>> {
  const updates = new Map<string, RankUpdate>();
  if (orderedIds.length === 0) return updates;
  const moves = rankMoves(orderedIds.length);
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: users.id, rankLevel: users.rankLevel })
      .from(users)
      .where(inArray(users.id, orderedIds));
    const levels = new Map(rows.map((row) => [row.id, row.rankLevel]));
    for (const [index, id] of orderedIds.entries()) {
      const before = levels.get(id);
      if (before === undefined) continue;
      const after = clampRankLevel(before + moves[index]);
      if (after !== before) await tx.update(users).set({ rankLevel: after }).where(eq(users.id, id));
      updates.set(id, { rankLevel: after, rankChange: after - before });
    }
  });
  return updates;
}

export type XpUpdate = { xp: number | null; xpGained: number };

// XP aux inscrits selon leur place (#35) ; un invité n'en gagne pas (xp = null).
// multiplier : difficulté des bots de la course (lib/bots.ts), 1 sans bot.
export async function awardXp(ranked: Placement[], multiplier = 1): Promise<Map<string, XpUpdate>> {
  const updates = new Map<string, XpUpdate>();
  if (ranked.length === 0) return updates;
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: users.id, xp: users.xp, isGuest: users.isGuest })
      .from(users)
      .where(inArray(users.id, ranked.map((placement) => placement.id)));
    for (const row of rows) {
      if (row.isGuest) {
        updates.set(row.id, { xp: null, xpGained: 0 });
        continue;
      }
      const placement = ranked.find((candidate) => candidate.id === row.id)!;
      const xpGained = Math.round(
        raceXp(placement.rank, ranked.length, placement.finished) * multiplier,
      );
      if (xpGained === 0) {
        updates.set(row.id, { xp: row.xp, xpGained });
        continue;
      }
      const [updated] = await tx
        .update(users)
        .set({ xp: sql`${users.xp} + ${xpGained}` })
        .where(eq(users.id, row.id))
        .returning({ xp: users.xp });
      updates.set(row.id, { xp: updated.xp, xpGained });
    }
  });
  return updates;
}
