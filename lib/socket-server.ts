// Serveur Socket.IO attaché au serveur HTTP de Next.js (ADR 0001).
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { SESSION_COOKIE, validateSessionToken, type User } from "./auth.ts";
import {
  addParticipant,
  canEnterLobby,
  closeLobby,
  findOpenLobby,
  listParticipants,
  MAX_PARTICIPANTS,
  removeParticipant,
  type Lobby,
} from "./lobbies.ts";
import { nextLobbyState, type LobbyState } from "./lobby-state.ts";
import { createRace, markRaceStarted } from "./races.ts";
import {
  joinLobbySchema,
  MIN_RACERS,
  type Ack,
  type CountdownMessage,
  type ParticipantsMessage,
  type RaceStartedMessage,
} from "./socket-messages.ts";

type SocketData = { user: User; lobby?: Lobby };

// Course en cours d'un lobby ; un lobby absent de la liste est en attente.
type LiveRace = { state: LobbyState; goAt: number } & RaceStartedMessage;

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(";") ?? []) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export function createSocketServer(
  httpServer: HttpServer,
  { countdownMs = 5000 } = {},
): Server {
  const io = new Server<
    Record<string, never>,
    {
      "lobby:participants": (message: ParticipantsMessage) => void;
      "lobby:closed": () => void;
      "race:countdown": (message: CountdownMessage) => void;
      "race:started": (message: RaceStartedMessage) => void;
    },
    Record<string, never>,
    SocketData
  >(httpServer);

  // Gardé en mémoire : un seul processus Node sert toutes les salles (ADR 0001).
  const liveRaces = new Map<string, LiveRace>();

  // Faux si la machine à états refuse l'événement (ex. fermer pendant la course).
  function canDo(lobby: Lobby, event: "start" | "close"): boolean {
    try {
      nextLobbyState(liveRaces.get(lobby.id)?.state ?? "waiting", event);
      return true;
    } catch {
      return false;
    }
  }

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

      // Une place se libère quand quelqu'un part ; déjà présent (autre onglet), on entre (LOB-6).
      const participants = await listParticipants(lobby.id);
      if (
        participants.length >= MAX_PARTICIPANTS &&
        !participants.some((participant) => participant.id === socket.data.user.id)
      ) {
        ack?.({ ok: false, error: "lobbyFull" });
        return;
      }

      socket.data.lobby = lobby;
      await addParticipant(lobby.id, socket.data.user.id);
      await socket.join(lobby.code);
      await sendParticipants(lobby);

      // Arrivé pendant le compte à rebours ou la course : il voit la suite sans courir.
      const race = liveRaces.get(lobby.id);
      if (race?.state === "countdown") {
        socket.emit("race:countdown", {
          seconds: Math.ceil((race.goAt - Date.now()) / 1000),
        });
      } else if (race?.state === "racing") {
        socket.emit("race:started", {
          content: race.content,
          errorMode: race.errorMode,
          racerIds: race.racerIds,
        });
      }
      ack?.({ ok: true });
    });

    // Seul l'hôte lance la course ; tous reçoivent le même compte à rebours, puis le même texte (CRS-1).
    socket.on("race:start", async (ack?: (response: Ack) => void) => {
      const { lobby, user } = socket.data;
      if (!lobby) {
        ack?.({ ok: false, error: "lobbyNotFound" });
        return;
      }
      if (lobby.hostId !== user.id) {
        ack?.({ ok: false, error: "notHost" });
        return;
      }
      const participants = await listParticipants(lobby.id);
      if (participants.length < MIN_RACERS) {
        ack?.({ ok: false, error: "notEnoughParticipants" });
        return;
      }
      // Vérifié après le dernier await : un double clic ne lance pas deux courses.
      if (!canDo(lobby, "start")) {
        ack?.({ ok: false, error: "raceInProgress" });
        return;
      }
      const live: LiveRace = {
        state: nextLobbyState("waiting", "start"),
        goAt: Date.now() + countdownMs,
        content: "",
        errorMode: lobby.errorMode,
        racerIds: participants.map((participant) => participant.id),
      };
      liveRaces.set(lobby.id, live);

      const race = await createRace(lobby);
      if (!race) {
        liveRaces.delete(lobby.id);
        ack?.({ ok: false, error: "noText" });
        return;
      }
      live.content = race.content;

      io.to(lobby.code).emit("race:countdown", { seconds: Math.ceil(countdownMs / 1000) });
      ack?.({ ok: true });

      setTimeout(async () => {
        live.state = nextLobbyState(live.state, "countdownEnd");
        await markRaceStarted(race.id);
        io.to(lobby.code).emit("race:started", {
          content: live.content,
          errorMode: live.errorMode,
          racerIds: live.racerIds,
        });
      }, countdownMs);
    });

    // Seul l'hôte ferme le lobby ; tous les participants sont renvoyés à la liste (LOB-10).
    socket.on("lobby:close", async (ack?: (response: Ack) => void) => {
      const { lobby, user } = socket.data;
      if (!lobby) {
        ack?.({ ok: false, error: "lobbyNotFound" });
        return;
      }
      if (lobby.hostId !== user.id) {
        ack?.({ ok: false, error: "notHost" });
        return;
      }
      // Pendant le compte à rebours ou la course, l'hôte ne peut pas fermer (#3).
      if (!canDo(lobby, "close")) {
        ack?.({ ok: false, error: "raceInProgress" });
        return;
      }

      liveRaces.delete(lobby.id);
      await closeLobby(lobby.id);
      io.to(lobby.code).emit("lobby:closed");
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
