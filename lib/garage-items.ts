// Catalogue du garage, sans accès à la base : utilisable côté client (#34).
import { z } from "zod";

// Le premier de chaque liste est le choix par défaut.
export const CARS = ["octane", "fennec", "dominus", "merc"] as const;
// Pas de « none » : une voiture a toujours un boost.
export const BOOSTS = ["standard", "flames"] as const;
export const HATS = ["none", "cone"] as const;
// « none » garde le ballon standard.
export const BALLS = ["none", "beach"] as const;

// Modèles pas encore dessinés : on affiche une silhouette.
export const PLACEHOLDER_CARS: readonly Car[] = ["fennec", "dominus", "merc"];

export type Car = (typeof CARS)[number];
export type Loadout = { car: Car; boost: (typeof BOOSTS)[number]; hat: (typeof HATS)[number]; ball: (typeof BALLS)[number] };

export const DEFAULT_LOADOUT: Loadout = { car: CARS[0], boost: BOOSTS[0], hat: HATS[0], ball: BALLS[0] };

export const loadoutSchema = z.object({
  car: z.enum(CARS),
  boost: z.enum(BOOSTS),
  hat: z.enum(HATS),
  ball: z.enum(BALLS),
});
