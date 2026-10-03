// Joueurs affichés sur la piste : le top 10, plus ceux juste devant et derrière toi (CRS-2).
import type { RacePositionsMessage } from "./socket-messages.ts";

export type Ranked = RacePositionsMessage["positions"][number] & { rank: number };

export const TOP = 10;

// positions est déjà trié du premier au dernier ; un spectateur ne voit que le top 10.
export function selectShown(positions: RacePositionsMessage["positions"], userId: string): Ranked[] {
  const ranked = positions.map((entry, index) => ({ ...entry, rank: index + 1 }));
  const you = ranked.findIndex((entry) => entry.id === userId);
  const top = ranked.slice(0, TOP);
  if (you < TOP) return top;
  return [...top, ...ranked.slice(Math.max(TOP, you - 1), you + 2)];
}
