// XP et niveaux (#35) : sans accès à la base, le tableau des résultats l'importe côté client.

// Inscrits seulement : 1er = 100 XP, dernier = 20 ; rien si pas fini ou seul en course.
// players = tous ceux qui ont pris le départ, invités compris.
export function raceXp(rank: number, players: number, finished: boolean): number {
  if (!finished || players < 2) return 0;
  return Math.round(20 + 80 * (1 - (rank - 1) / (players - 1)));
}

// Passer du niveau L à L+1 coûte 100 × L XP ; tout le monde commence au niveau 1.
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

// Avancement dans le niveau en cours, pour la barre du profil.
export function levelProgress(xp: number): { level: number; current: number; needed: number } {
  const level = levelFromXp(xp);
  return { level, current: xp - xpForLevel(level), needed: 100 * level };
}
