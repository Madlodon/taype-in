import type { RemovedWord } from "./race-goals.ts";
// Messages Socket.IO envoyés par le client, validés avec Zod.
import { z } from "zod";

export const joinLobbySchema = z.object({
  code: z.string().trim().min(1).max(16),
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

// LOB-6 : au moins 2 participants pour démarrer.
export const MIN_RACERS = 2;

// Réponse (ack) du serveur à un message du client ; error est une clé de traduction (LobbyRoom.errors).
export type Ack = { ok: true } | { ok: false; error: string };

// Envoyé à toute la salle quand quelqu'un arrive ou part.
export type ParticipantsMessage = {
  participants: { id: string; username: string }[];
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
  positions: { id: string; username: string; position: number }[];
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
