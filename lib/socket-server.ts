// Serveur Socket.IO attaché au serveur HTTP de Next.js (ADR 0001).
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { joinLobbySchema, type Ack } from "./socket-messages.ts";

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer);

  io.on("connection", (socket) => {
    // Un lobby = une salle Socket.IO nommée par son code.
    socket.on("lobby:join", (payload: unknown, ack?: (response: Ack) => void) => {
      const result = joinLobbySchema.safeParse(payload);
      if (!result.success) {
        ack?.({ ok: false, error: "Message invalide" });
        return;
      }

      const { code } = result.data;
      socket.join(code);
      socket.to(code).emit("lobby:playerJoined", { id: socket.id });
      ack?.({ ok: true });
    });
  });

  return io;
}
