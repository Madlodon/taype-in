// Messages Socket.IO envoyés par le client, validés avec Zod.
import { z } from "zod";

export const joinLobbySchema = z.object({
  code: z.string().trim().min(1).max(16),
});

export type JoinLobbyMessage = z.infer<typeof joinLobbySchema>;

// Envoyé par un coureur à chaque frappe : position = nombre de caractères tapés correctement.
export const progressSchema = z.object({
  position: z.number().int().min(0),
});

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

// Le « Go » : même texte pour tous ; racerIds = ceux qui courent (arrivés après : spectateurs).
// secondsLeft = temps restant à la minuterie, null sans minuterie (CRS-4).
export type RaceStartedMessage = {
  content: string;
  racerIds: string[];
  secondsLeft: number | null;
};

// Fin de course : tous ont fini, minuterie écoulée ou 2 min sans frappe (CRS-5).
export type RaceEndedMessage = { reason: "allFinished" | "timeUp" | "idle" };
