// Serveur Socket.IO attaché au serveur HTTP de Next.js (ADR 0001).
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { SESSION_COOKIE, validateSessionToken, type User } from "./auth.ts";
import {
  addParticipant,
  canEnterLobby,
  findOpenLobby,
  listParticipants,
  removeParticipant,
  type Lobby,
} from "./lobbies.ts";
import { joinLobbySchema, type Ack, type ParticipantsMessage } from "./socket-messages.ts";

type SocketData = { user: User; lobby?: Lobby };

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(";") ?? []) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server<
    Record<string, never>,
    { "lobby:participants": (message: ParticipantsMessage) => void },
    Record<string, never>,
    SocketData
  >(httpServer);

  async function sendParticipants(lobby: Lobby) {
    io.to(lobby.code).emit("lobby:participants", {
      participants: await listParticipants(lobby.id),
    });
  }

  // Le cookie de session (httpOnly) accompagne la connexion : seul un utilisateur connecté entre.
  io.use(async (socket, next) => {
    const token = readCookie(socket.handshake.headers.cookie, SESSION_COOKIE);
    const user = token ? await validateSessionToken(token) : null;
    if (!user) return next(new Error("notLoggedIn"));
    socket.data.user = user;
    next();
  });

  io.on("connection", (socket) => {
    // Un lobby = une salle Socket.IO nommée par son code.
    socket.on("lobby:join", async (payload: unknown, ack?: (response: Ack) => void) => {
      const result = joinLobbySchema.safeParse(payload);
      if (!result.success) {
        ack?.({ ok: false, error: "invalidMessage" });
        return;
      }

      // Une course privée sans invitation se comporte comme une course inexistante.
      const lobby = await findOpenLobby(result.data.code);
      if (!lobby || !(await canEnterLobby(lobby, socket.data.user.id))) {
        ack?.({ ok: false, error: "lobbyNotFound" });
        return;
      }

      socket.data.lobby = lobby;
      await addParticipant(lobby.id, socket.data.user.id);
      await socket.join(lobby.code);
      await sendParticipants(lobby);
      ack?.({ ok: true });
    });

    socket.on("disconnect", async () => {
      const { lobby, user } = socket.data;
      if (!lobby) return;

      // Le même utilisateur peut avoir un autre onglet ouvert dans ce lobby.
      const others = await io.in(lobby.code).fetchSockets();
      if (others.some((other) => other.data.user.id === user.id)) return;

      await removeParticipant(lobby.id, user.id);
      await sendParticipants(lobby);
    });
  });

  return io;
}
