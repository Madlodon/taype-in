// Messages Socket.IO envoyés par le client, validés avec Zod.
import { z } from "zod";

export const joinLobbySchema = z.object({
  code: z.string().trim().min(1).max(16),
});

export type JoinLobbyMessage = z.infer<typeof joinLobbySchema>;

// Envoyé par un coureur à chaque frappe : tout ce qu'il a tapé et ses fautes,
// pour qu'il reprenne exactement là où il était s'il revient (CRS-6).
export const progressSchema = z.object({
  typed: z.string().max(10_000),
  errors: z.number().int().min(0),
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
  mine?: ProgressMessage & { gaveUp: boolean };
};

// Classement en direct, du premier au dernier ; position = caractères tapés (CRS-2).
export type RacePositionsMessage = {
  positions: { id: string; username: string; position: number }[];
};

// Fin de course : tous ont fini, minuterie écoulée ou 2 min sans frappe (CRS-5).
export type RaceEndedMessage = { reason: "allFinished" | "timeUp" | "idle" };
