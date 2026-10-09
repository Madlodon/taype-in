import type { RemovedWord } from "./race-goals.ts";
// Messages Socket.IO envoyés par le client, validés avec Zod.
import { z } from "zod";
import { BOT_LEVELS, type Bot } from "./bots.ts";

// leave : la personne accepte de quitter le lobby où elle est déjà (SALLE-06).
export const joinLobbySchema = z.object({
  code: z.string().trim().min(1).max(16),
  leave: z.boolean().optional(),
});

export type JoinLobbyMessage = z.infer<typeof joinLobbySchema>;

// Envoyé par un coureur à chaque frappe : tout ce qu'il a tapé et ses fautes,
// pour qu'il reprenne exactement là où il était s'il revient (CRS-6).
// keys et keyErrors servent à la précision et à l'historique des fautes par touche (ERR-3).
export const progressSchema = z.object({
  typed: z.string().max(10_000),
  errors: z.number().int().min(0),
  keys: z.number().int().min(0),
  keyErrors: z.record(z.string().max(2), z.number().int().min(1)),
});

export type ProgressMessage = z.infer<typeof progressSchema>;

// L'hôte lance la course en courant ou seulement en regardant (LOB-8).
export const startRaceSchema = z.object({ watch: z.boolean() });

// L'hôte ajoute un bot du niveau choisi, ou en retire un, dans la salle d'attente (BOT-1).
export const addBotSchema = z.object({ level: z.enum(BOT_LEVELS) });
export const removeBotSchema = z.object({ id: z.string() });

// L'hôte exclut un participant ou un spectateur (SALLE-07).
export const kickSchema = z.object({ id: z.string() });

// LOB-6 : au moins 2 coureurs pour démarrer ; un hôte qui regarde ne compte pas (LOB-8), un bot compte (BOT-1).
export const MIN_RACERS = 2;

// Réponse (ack) du serveur à un message du client ; error est une clé de traduction (LobbyRoom.errors).
export type Ack = { ok: true } | { ok: false; error: string };

// Envoyé à toute la salle quand quelqu'un arrive ou part, ou qu'un bot est ajouté ou retiré.
// bot : présent seulement pour un bot, pour l'afficher comme tel (BOT-3).
// hostId suit les transferts d'hôte (SALLE-08).
export type ParticipantsMessage = {
  hostId: string;
  participants: { id: string; username: string; bot?: Bot }[];
};

// Envoyé à toute la salle quand l'hôte lance la course ; le texte reste caché jusqu'au « Go ».
export type CountdownMessage = { seconds: number };

// Le « Go » : même texte et même mode d'erreur pour tous ; racerIds = ceux qui courent (arrivés après : spectateurs).
// secondsLeft = temps restant à la minuterie, null sans minuterie (CRS-4).
// mine : envoyé seulement à un coureur qui revient, pour reprendre où il était (CRS-6) ou rester spectateur s'il a abandonné (CRS-7).
export type RaceStartedMessage = {
  content: string;
  errorMode: "blocking" | "tolerant";
  racerIds: string[];
  secondsLeft: number | null;
  mine?: ProgressMessage & { gaveUp: boolean; removed?: RemovedWord[] };
};

// Classement en direct, du premier au dernier ; position = caractères tapés (CRS-2).
export type RacePositionsMessage = {
  positions: { id: string; username: string; position: number; bot?: Bot }[];
};

// Résultat d'un coureur, du premier au dernier (FIN-2) ; accuracy en %, penaltyMs = +1 s par faute en mode tolérant.
export type RaceResult = {
  id: string;
  username: string;
  rank: number;
  wpm: number;
  accuracy: number;
  durationMs: number;
  penaltyMs: number;
  errors: number;
  finished: boolean;
  keyErrors: Record<string, number>;
  // Rang après la course (lib/ranks.ts) et sa variation : +1, 0 ou -1 division (#99).
  rankLevel: number;
  rankChange: number;
  bot?: Bot;
  // XP totale après la course et XP gagnée (#35) ; xp = null pour un invité.
  xp: number | null;
  xpGained: number;
};

// Fin de course : tous ont fini, minuterie écoulée ou 2 min sans frappe (CRS-5), avec le classement final.
export type RaceEndedMessage = {
  reason: "allFinished" | "timeUp" | "idle";
  results: RaceResult[];
};

// The server owns shot outcomes and the removed word offsets.
export type RaceShotMessage = { id: string; sequence: number; scored: boolean };
export type RaceGoalMessage = { removed: RemovedWord[]; word?: string };

export type RaceBoostMessage = { id: string };
