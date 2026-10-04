// Catalogue du garage, sans accès à la base : utilisable côté client (#34).
import { z } from "zod";

// Le premier de chaque liste est le choix par défaut.
export const CARS = ["octane", "fennec", "dominus", "merc"] as const;
// Pas de « none » : une voiture a toujours un boost.
export const BOOSTS = ["standard", "flames", "ion", "sparkles"] as const;
export const HATS = ["none", "cone", "alpha-cap", "top-hat", "pirate", "wizard"] as const;
// « none » garde le ballon standard.
export const BALLS = ["none", "beach", "emerald", "glacier", "solar"] as const;
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
