// Rangs façon Rocket League (#99) : Bronze I à Grand Champion III, 4 divisions chacun, puis Supersonic Legend.
import { eq, inArray } from "drizzle-orm";
import { db } from "../db/index.ts";
import { users } from "../db/schema.ts";

export const RANK_TIERS = [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
  "champion",
  "grandChampion",
] as const;

export type RankTier = (typeof RANK_TIERS)[number] | "supersonicLegend";

const SUB_RANKS = 3;
const DIVISIONS = 4;

// Niveau 0 = Bronze I div. I ; le dernier niveau = Supersonic Legend (sans division).
export const MAX_RANK_LEVEL = RANK_TIERS.length * SUB_RANKS * DIVISIONS;

export type Rank =
  | { tier: (typeof RANK_TIERS)[number]; subRank: number; division: number }
  | { tier: "supersonicLegend" };

// subRank et division commencent à 1 (Or II div. III = { gold, 2, 3 }).
export function rankFromLevel(level: number): Rank {
  if (level >= MAX_RANK_LEVEL) return { tier: "supersonicLegend" };
  return {
    tier: RANK_TIERS[Math.floor(level / (SUB_RANKS * DIVISIONS))],
    subRank: (Math.floor(level / DIVISIONS) % SUB_RANKS) + 1,
    division: (level % DIVISIONS) + 1,
  };
}

// Combien montent (en haut) et descendent (en bas) : jamais plus de 5, et au moins 1 dès 2 joueurs.
export function movingCount(players: number): number {
  if (players < 2) return 0;
  return Math.min(5, Math.max(1, Math.floor((players - 1) / 2)));
}

// +1 division pour le haut du classement, -1 pour le bas, 0 au milieu ; index 0 = premier.
export function rankMoves(players: number): number[] {
  const moving = movingCount(players);
  return Array.from({ length: players }, (_, index) =>
    index < moving ? 1 : index >= players - moving ? -1 : 0,
  );
}

export function clampRankLevel(level: number): number {
  return Math.min(MAX_RANK_LEVEL, Math.max(0, level));
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
