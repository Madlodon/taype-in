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
import { createRace, markRaceEnded, markRaceStarted } from "./races.ts";
import {
  joinLobbySchema,
  MIN_RACERS,
  progressSchema,
  type Ack,
  type CountdownMessage,
  type ParticipantsMessage,
  type RaceEndedMessage,
  type RaceStartedMessage,
} from "./socket-messages.ts";

type SocketData = { user: User; lobby?: Lobby };

// Course en cours d'un lobby ; un lobby absent de la liste est en attente.
type LiveRace = {
  state: LobbyState;
  raceId: string;
  goAt: number;
  content: string;
  errorMode: RaceStartedMessage["errorMode"];
  racerIds: string[];
  timeLimitSeconds: number | null;
  // Fin prévue par la minuterie (ms) ; null sans minuterie.
  endsAt: number | null;
  finishedIds: Set<string>;
  endTimer?: NodeJS.Timeout;
  idleTimer?: NodeJS.Timeout;
  endReason?: RaceEndedMessage["reason"];
};

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(";") ?? []) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export function createSocketServer(
  httpServer: HttpServer,
  // CRS-5 : la course s'arrête après 2 min sans aucune frappe.
  { countdownMs = 5000, idleMs = 2 * 60 * 1000 } = {},
): Server {
  const io = new Server<
    Record<string, never>,
    {
      "lobby:participants": (message: ParticipantsMessage) => void;
      "lobby:closed": () => void;
      "race:countdown": (message: CountdownMessage) => void;
      "race:started": (message: RaceStartedMessage) => void;
      "race:ended": (message: RaceEndedMessage) => void;
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

  function secondsLeft(live: LiveRace): number | null {
    return live.endsAt === null ? null : Math.max(0, Math.ceil((live.endsAt - Date.now()) / 1000));
  }

  async function endRace(lobby: Lobby, live: LiveRace, reason: RaceEndedMessage["reason"]) {
    // Une seule fin, même si deux conditions arrivent en même temps.
    if (live.state !== "racing") return;
    live.state = nextLobbyState(live.state, "end");
    live.endReason = reason;
    clearTimeout(live.endTimer);
    clearTimeout(live.idleTimer);
    await markRaceEnded(live.raceId);
    io.to(lobby.code).emit("race:ended", { reason });
  }

  // Chaque frappe repousse la fin pour inactivité.
  function resetIdleTimer(lobby: Lobby, live: LiveRace) {
    clearTimeout(live.idleTimer);
    live.idleTimer = setTimeout(() => endRace(lobby, live, "idle"), idleMs);
  }

  // Serveur arrêté : les minuteries des courses en cours ne doivent plus se déclencher.
  httpServer.on("close", () => {
    for (const live of liveRaces.values()) {
      clearTimeout(live.endTimer);
      clearTimeout(live.idleTimer);
    }
  });

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
          secondsLeft: secondsLeft(race),
        });
      } else if (race?.endReason) {
        socket.emit("race:ended", { reason: race.endReason });
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
        raceId: "",
        goAt: Date.now() + countdownMs,
        content: "",
        errorMode: lobby.errorMode,
        racerIds: participants.map((participant) => participant.id),
        timeLimitSeconds: null,
        endsAt: null,
        finishedIds: new Set(),
      };
      liveRaces.set(lobby.id, live);

      const race = await createRace(lobby);
      if (!race) {
        liveRaces.delete(lobby.id);
        ack?.({ ok: false, error: "noText" });
        return;
      }
      live.raceId = race.id;
      live.content = race.content;
      live.timeLimitSeconds = race.timeLimitSeconds;

      io.to(lobby.code).emit("race:countdown", { seconds: Math.ceil(countdownMs / 1000) });
      ack?.({ ok: true });

      setTimeout(async () => {
        live.state = nextLobbyState(live.state, "countdownEnd");
        await markRaceStarted(race.id);
        if (live.timeLimitSeconds !== null) {
          live.endsAt = Date.now() + live.timeLimitSeconds * 1000;
          live.endTimer = setTimeout(
            () => endRace(lobby, live, "timeUp"),
            live.timeLimitSeconds * 1000,
          );
        }
        resetIdleTimer(lobby, live);
        io.to(lobby.code).emit("race:started", {
          content: live.content,
          errorMode: live.errorMode,
          racerIds: live.racerIds,
          secondsLeft: secondsLeft(live),
        });
      }, countdownMs);
    });

    // Progression d'un coureur ; la course finit quand tous ont tapé tout le texte (CRS-5).
    socket.on("race:progress", async (payload: unknown, ack?: (response: Ack) => void) => {
      const { lobby, user } = socket.data;
      const result = progressSchema.safeParse(payload);
      if (!result.success) {
        ack?.({ ok: false, error: "invalidMessage" });
        return;
      }
      const live = lobby && liveRaces.get(lobby.id);
      if (!lobby || live?.state !== "racing") {
        ack?.({ ok: false, error: "raceNotRunning" });
        return;
      }
      if (!live.racerIds.includes(user.id)) {
        ack?.({ ok: false, error: "notRacer" });
        return;
      }
      if (result.data.position > live.content.length) {
        ack?.({ ok: false, error: "invalidMessage" });
        return;
      }

      resetIdleTimer(lobby, live);
      if (result.data.position === live.content.length) {
        live.finishedIds.add(user.id);
        if (live.finishedIds.size === live.racerIds.length) {
          await endRace(lobby, live, "allFinished");
        }
      }
      ack?.({ ok: true });
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
