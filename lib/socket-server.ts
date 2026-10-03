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
import { nextPlayerState, type PlayerState } from "./player-state.ts";
import { createRace, markRaceEnded, markRaceStarted } from "./races.ts";
import {
  joinLobbySchema,
  MIN_RACERS,
  progressSchema,
  type Ack,
  type CountdownMessage,
  type ParticipantsMessage,
  type ProgressMessage,
  type RaceEndedMessage,
  type RacePositionsMessage,
  type RaceStartedMessage,
} from "./socket-messages.ts";

type SocketData = { user: User; lobby?: Lobby };

// Un coureur et ce qu'il a tapé, gardé pour qu'il reprenne où il était (CRS-6).
type Player = ProgressMessage & { state: PlayerState };

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
  players: Map<string, Player>;
  // Position de chaque coureur et moment où il l'a atteinte (départage les égalités).
  positions: Map<string, { username: string; position: number; at: number }>;
  positionsChanged: boolean;
  endTimer?: NodeJS.Timeout;
  idleTimer?: NodeJS.Timeout;
  positionsTimer?: NodeJS.Timeout;
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
  // CRS-2 : les positions partent au plus toutes les 250 ms, seulement si quelqu'un a bougé.
  { countdownMs = 5000, idleMs = 2 * 60 * 1000, positionsMs = 250 } = {},
): Server {
  const io = new Server<
    Record<string, never>,
    {
      "lobby:participants": (message: ParticipantsMessage) => void;
      "lobby:closed": () => void;
      "race:countdown": (message: CountdownMessage) => void;
      "race:started": (message: RaceStartedMessage) => void;
      "race:positions": (message: RacePositionsMessage) => void;
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

  // Classement : le plus avancé d'abord ; à égalité, celui qui y est arrivé le premier.
  function ranking(live: LiveRace): RacePositionsMessage {
    const positions = [...live.positions].sort(
      ([, a], [, b]) => b.position - a.position || a.at - b.at,
    );
    return {
      positions: positions.map(([id, { username, position }]) => ({ id, username, position })),
    };
  }

  function sendPositions(lobby: Lobby, live: LiveRace) {
    if (!live.positionsChanged) return;
    live.positionsChanged = false;
    io.to(lobby.code).emit("race:positions", ranking(live));
  }

  async function endRace(lobby: Lobby, live: LiveRace, reason: RaceEndedMessage["reason"]) {
    // Une seule fin, même si deux conditions arrivent en même temps.
    if (live.state !== "racing") return;
    live.state = nextLobbyState(live.state, "end");
    live.endReason = reason;
    clearTimeout(live.endTimer);
    clearTimeout(live.idleTimer);
    clearInterval(live.positionsTimer);
    // Les dernières frappes arrivent avant la fin.
    sendPositions(lobby, live);
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
      clearInterval(live.positionsTimer);
    }
  });

  // La course finit quand plus personne ne court : un absent compte encore, il peut revenir (CRS-6).
  async function endIfNobodyRacing(lobby: Lobby, live: LiveRace) {
    const states = [...live.players.values()].map((player) => player.state);
    if (states.every((state) => state === "finished" || state === "abandoned")) {
      await endRace(lobby, live, "allFinished");
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

      // Un coureur qui revient reprend la course (CRS-6) ; un autre la regarde sans courir.
      const race = liveRaces.get(lobby.id);
      const player = race?.players.get(socket.data.user.id);
      if (player?.state === "disconnected" && race?.state !== "finished") {
        player.state = nextPlayerState(player.state, "reconnect");
      }
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
          mine: player && {
            typed: player.typed,
            errors: player.errors,
            keys: player.keys,
            keyErrors: player.keyErrors,
            gaveUp: player.state === "abandoned",
          },
        });
        socket.emit("race:positions", ranking(race));
      } else if (race?.endReason) {
        socket.emit("race:positions", ranking(race));
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
        players: new Map(
          participants.map((participant) => [
            participant.id,
            { state: "connected", typed: "", errors: 0, keys: 0, keyErrors: {} },
          ]),
        ),
        positions: new Map(),
        positionsChanged: false,
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
        // Tous les coureurs partent de 0, dans l'ordre d'arrivée dans le lobby.
        for (const { id, username } of participants) {
          live.positions.set(id, { username, position: 0, at: Date.now() });
        }
        live.positionsChanged = true;
        sendPositions(lobby, live);
        live.positionsTimer = setInterval(() => sendPositions(lobby, live), positionsMs);
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
      const player = live.players.get(user.id);
      if (!player || player.state === "abandoned") {
        ack?.({ ok: false, error: "notRacer" });
        return;
      }
      if (result.data.typed.length > live.content.length) {
        ack?.({ ok: false, error: "invalidMessage" });
        return;
      }

      resetIdleTimer(lobby, live);
      // Une fois fini, sa saisie ne change plus (ex. renvoyée après une reconnexion).
      if (player.state === "connected") {
        player.typed = result.data.typed;
        player.errors = result.data.errors;
        player.keys = result.data.keys;
        player.keyErrors = result.data.keyErrors;
        const racer = live.positions.get(user.id)!;
        if (racer.position !== player.typed.length) {
          live.positions.set(user.id, { ...racer, position: player.typed.length, at: Date.now() });
          live.positionsChanged = true;
        }
        if (player.typed.length === live.content.length) {
          player.state = nextPlayerState(player.state, "finish");
          await endIfNobodyRacing(lobby, live);
        }
      }
      ack?.({ ok: true });
    });

    // Le coureur abandonne et devient spectateur ; la course continue sans lui (CRS-7).
    socket.on("race:giveUp", async (ack?: (response: Ack) => void) => {
      const { lobby, user } = socket.data;
      const live = lobby && liveRaces.get(lobby.id);
      if (!lobby || live?.state !== "racing") {
        ack?.({ ok: false, error: "raceNotRunning" });
        return;
      }
      const player = live.players.get(user.id);
      if (!player) {
        ack?.({ ok: false, error: "notRacer" });
        return;
      }
      if (player.state !== "connected") {
        ack?.({ ok: false, error: "cannotGiveUp" });
        return;
      }

      player.state = nextPlayerState(player.state, "abandon");
      await endIfNobodyRacing(lobby, live);
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

      // Un coureur qui perd la connexion garde sa place ; la course continue sans lui (CRS-6).
      const live = liveRaces.get(lobby.id);
      const player = live?.players.get(user.id);
      if (player?.state === "connected" && live?.state !== "finished") {
        player.state = nextPlayerState(player.state, "disconnect");
      }

      await removeParticipant(lobby.id, user.id);
      await sendParticipants(lobby);
    });
  });

  return io;
}
