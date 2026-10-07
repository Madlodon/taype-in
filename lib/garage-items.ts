// Catalogue du garage, sans accès à la base : utilisable côté client (#34).
import { z } from "zod";

// Le premier de chaque liste est le choix par défaut.
export const CARS = ["octane", "fennec", "dominus", "merc"] as const;
// Pas de « none » : une voiture a toujours un boost.
export const BOOSTS = ["standard", "flames", "ion", "sparkles", "alpha"] as const;
export const HATS = ["none", "cone", "alpha-cap", "top-hat", "pirate", "wizard"] as const;
// « none » garde le ballon standard.
export const BALLS = ["none", "beach", "emerald", "glacier", "solar", "gold"] as const;
export const STADIUMS = ["diorama", "cutaway", "top-down"] as const;
export type Stadium = (typeof STADIUMS)[number];
export const STADIUM_IMAGES: Record<Stadium, string> = {
  diorama: "/stadiums/diorama.webp",
  cutaway: "/stadiums/cutaway.webp",
  "top-down": "/stadiums/top-down.svg",
};

export type Car = (typeof CARS)[number];
export type Loadout = { car: Car; boost: (typeof BOOSTS)[number]; hat: (typeof HATS)[number]; ball: (typeof BALLS)[number]; stadium: Stadium };

export const DEFAULT_LOADOUT: Loadout = { car: CARS[0], boost: BOOSTS[0], hat: HATS[0], ball: BALLS[0], stadium: STADIUMS[0] };

export const loadoutSchema = z.object({
  car: z.enum(CARS),
  boost: z.enum(BOOSTS),
  hat: z.enum(HATS),
  ball: z.enum(BALLS),
  stadium: z.enum(STADIUMS).default(DEFAULT_LOADOUT.stadium),
});

export type Category = "car" | "boost" | "hat" | "ball";
export const CATEGORIES = ["car", "boost", "hat", "ball"] as const satisfies Category[];

// Niveau requis pour chaque objet (#35) ; absent = libre (choix par défaut). Les stades sont libres.
export const UNLOCK_LEVELS: { [C in Category]: Partial<Record<Loadout[C], number>> } = {
  car: { merc: 4, dominus: 7, fennec: 12 },
  boost: { flames: 3, ion: 6, sparkles: 10, alpha: 15 },
  hat: { cone: 2, wizard: 7, "top-hat": 8, pirate: 12, "alpha-cap": 15 },
  ball: { beach: 2, emerald: 5, glacier: 8, solar: 14, gold: 15 },
};

export function unlockLevel<C extends Category>(category: C, item: Loadout[C]): number {
  return UNLOCK_LEVELS[category][item] ?? 1;
}

// Objets débloqués en passant du niveau from au niveau to.
export function unlockedBetween(from: number, to: number): { category: Category; item: string }[] {
  return CATEGORIES.flatMap((category) =>
    Object.entries(UNLOCK_LEVELS[category])
      .filter(([, level]) => level! > from && level! <= to)
      .map(([item]) => ({ category, item })),
  );
}

// Un objet trop haut pour le niveau revient au choix par défaut.
export function lockLoadout(loadout: Loadout, level: number): Loadout {
  const locked = { ...loadout };
  for (const category of CATEGORIES) {
    if (unlockLevel(category, loadout[category]) > level) {
      (locked as Record<Category, string>)[category] = DEFAULT_LOADOUT[category];
    }
  }
  return locked;
}
