// Joueurs affichés sur la piste : le top 10, plus ceux juste devant et derrière toi (CRS-2).
import type { RacePositionsMessage } from "./socket-messages.ts";

export type Ranked = RacePositionsMessage["positions"][number] & { rank: number };

export const TOP = 10;

// positions est déjà trié du premier au dernier ; un spectateur ne voit que le top 10.
export function selectShown(
  positions: RacePositionsMessage["positions"],
  userId: string,
): Ranked[] {
  const ranked = positions.map((entry, index) => ({ ...entry, rank: index + 1 }));
  const you = ranked.findIndex((entry) => entry.id === userId);
  const top = ranked.slice(0, TOP);
  if (you < TOP) return top;
  return [...top, ...ranked.slice(Math.max(TOP, you - 1), you + 2)];
}

export type Overtake = { direction: "up" | "down"; names: string[]; rank: number };

// Dépassement entre deux classements (CRS-3) : en montant, ceux que tu as doublés ;
// en descendant, ceux qui t'ont doublé. Seuls les joueurs présents dans les deux comptent.
export function detectOvertake(
  previous: RacePositionsMessage["positions"],
  next: RacePositionsMessage["positions"],
  userId: string,
): Overtake | null {
  const rankBefore = (id: string) => previous.findIndex((entry) => entry.id === id);
  const before = rankBefore(userId);
  const after = next.findIndex((entry) => entry.id === userId);
  if (before === -1 || after === -1 || before === after) return null;
  const direction = after < before ? "up" : "down";
  // Ceux qui ont changé de côté par rapport à toi.
  const swapped =
    direction === "up"
      ? next
          .slice(after + 1)
          .filter((entry) => rankBefore(entry.id) > -1 && rankBefore(entry.id) < before)
      : next.slice(0, after).filter((entry) => rankBefore(entry.id) > before);
  if (swapped.length === 0) return null;
  return { direction, names: swapped.map((entry) => entry.username), rank: after + 1 };
}
