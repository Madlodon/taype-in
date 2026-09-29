// Messages Socket.IO envoyés par le client, validés avec Zod.
import { z } from "zod";

export const joinLobbySchema = z.object({
  code: z.string().trim().min(1).max(16),
});

export type JoinLobbyMessage = z.infer<typeof joinLobbySchema>;

// Réponse (ack) du serveur à un message du client.
export type Ack = { ok: true } | { ok: false; error: string };
