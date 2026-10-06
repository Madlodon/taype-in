import { completedSentences, thirdWordAhead, GOAL_CHANCE, SHOT_MS, type RemovedWord } from "./race-goals.ts";
// Serveur Socket.IO attaché au serveur HTTP de Next.js (ADR 0001).
import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { SESSION_COOKIE, validateSessionToken, type User } from "./auth.ts";
import { botKey, xpMultiplier, type Bot } from "./bots.ts";
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
import { awardXp, rankRacers, saveResults, updateRanks } from "./results.ts";
import {
  addBotSchema,
  joinLobbySchema,
  MIN_RACERS,
  progressSchema,
  removeBotSchema,
  startRaceSchema,
  type Ack,
  type CountdownMessage,
  type ParticipantsMessage,
  type ProgressMessage,
  type RaceEndedMessage,
  type RacePositionsMessage,
  type RaceResult,
  type RaceStartedMessage,
  type RaceShotMessage,
  type RaceGoalMessage,
} from "./socket-messages.ts";

type SocketData = { user: User; lobby?: Lobby };

// Un coureur et ce qu'il a tapé, gardé pour qu'il reprenne où il était (CRS-6).
// doneAt : moment où il a fini ou abandonné, pour son temps (FIN-2).
type Player = ProgressMessage & { state: PlayerState; doneAt?: number; removed: RemovedWord[]; sentences: Set<number> };

// Bot ajouté par l'hôte : un id au format d'un utilisateur, qui ne correspond à personne en base (BOT-1).
type BotParticipant = { id: string; username: string; bot: Bot };

// Course en cours d'un lobby ; un lobby absent de la liste est en attente.
type LiveRace = {
  state: LobbyState;
  raceId: string;
  goAt: number;
  // Moment du « Go », d'où partent les temps.
  startedAt: number;
  content: string;
  errorMode: RaceStartedMessage["errorMode"];
  racerIds: string[];
  timeLimitSeconds: number | null;
  // Fin prévue par la minuterie (ms) ; null sans minuterie.
  endsAt: number | null;
  players: Map<string, Player>;
  // Position de chaque coureur et moment où il l'a atteinte (départage les égalités).
  positions: Map<string, { username: string; position: number; at: number; bot?: Bot }>;
  positionsChanged: boolean;
  shotTimers: Set<NodeJS.Timeout>;
  // Prochaine touche de chaque bot.
  botTimers: Map<string, NodeJS.Timeout>;
  endTimer?: NodeJS.Timeout;
  idleTimer?: NodeJS.Timeout;
  positionsTimer?: NodeJS.Timeout;
  endReason?: RaceEndedMessage["reason"];
  results?: RaceResult[];
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
  // COURSE-03 : compte à rebours de 3 secondes (3, 2, 1).
  // CRS-5 : la course s'arrête après 2 min sans aucune frappe.
  // CRS-2 : les positions partent au plus toutes les 250 ms, seulement si quelqu'un a bougé.
  // botSpeedup accélère les bots, pour des tests rapides.
  {
    countdownMs = 3000,
    idleMs = 2 * 60 * 1000,
    positionsMs = 250,
    botSpeedup = 1,
    shotMs = SHOT_MS,
    shotRandom = Math.random,
    // goalChance = 0 : aucun but, pour les tests E2E qui tapent tout le texte.
    goalChance = GOAL_CHANCE,
  } = {},
): Server {
  const io = new Server<
    Record<string, never>,
    {
      "lobby:participants": (message: ParticipantsMessage) => void;
      "lobby:closed": () => void;
      "lobby:restarted": () => void;
      "race:countdown": (message: CountdownMessage) => void;
      "race:started": (message: RaceStartedMessage) => void;
      "race:positions": (message: RacePositionsMessage) => void;
      "race:shot": (message: RaceShotMessage) => void;
      "race:goal": (message: RaceGoalMessage) => void;
      "race:ended": (message: RaceEndedMessage) => void;
    },
    Record<string, never>,
    SocketData
  >(httpServer);

  // Gardé en mémoire : un seul processus Node sert toutes les salles (ADR 0001).
  const liveRaces = new Map<string, LiveRace>();
  // Bots de chaque lobby ; ils restent d'une course à l'autre jusqu'à ce que l'hôte les retire.
  const lobbyBots = new Map<string, BotParticipant[]>();

  // Les joueurs connectés, puis les bots : tous comptent comme participants (BOT-1).
  async function roomParticipants(lobby: Lobby): Promise<ParticipantsMessage["participants"]> {
    return [...(await listParticipants(lobby.id)), ...(lobbyBots.get(lobby.id) ?? [])];
  }

  // Faux si la machine à états refuse l'événement (ex. fermer pendant la course).
  function canDo(lobby: Lobby, event: "start" | "close" | "restart"): boolean {
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
      positions: positions.map(([id, { username, position, bot }]) => ({
        id,
        username,
        position,
        bot,
      })),
    };
  }

  function sendPositions(lobby: Lobby, live: LiveRace) {
    if (!live.positionsChanged) return;
    live.positionsChanged = false;
    io.to(lobby.code).emit("race:positions", ranking(live));
  }

  function stopTimers(live: LiveRace) {
    clearTimeout(live.endTimer);
    clearTimeout(live.idleTimer);
    clearInterval(live.positionsTimer);
    live.botTimers.forEach((timer) => clearTimeout(timer));
    live.shotTimers.forEach((timer) => clearTimeout(timer));
    live.shotTimers.clear();
  }

  async function endRace(lobby: Lobby, live: LiveRace, reason: RaceEndedMessage["reason"]) {
    // Une seule fin, même si deux conditions arrivent en même temps.
    if (live.state !== "racing") return;
    live.state = nextLobbyState(live.state, "end");
    live.endReason = reason;
    stopTimers(live);
    // Les dernières frappes arrivent avant la fin.
    sendPositions(lobby, live);
    const endedAt = Date.now();
    const placements = rankRacers(
      [...live.players].map(([id, player]) => {
        const { username, at } = live.positions.get(id)!;
        return {
          ...player,
          id,
          username,
          finished: player.state === "finished",
          durationMs: (player.doneAt ?? endedAt) - live.startedAt,
          reachedAt: at,
        };
      }),
      live.content,
      live.errorMode,
    );
    await markRaceEnded(live.raceId);
    // Les bots prennent une place au classement, sans ligne de résultat ni rang (aucun utilisateur en base).
    await saveResults(
      live.raceId,
      placements.filter((placement) => !live.positions.get(placement.id)?.bot),
    );
    const ranks = await updateRanks(placements.map((placement) => placement.id));
    // Les bots ne gagnent rien, mais leur niveau change l'XP des joueurs.
    const bots = [...live.positions.values()].flatMap(({ bot }) => (bot ? [bot.level] : []));
    const xp = await awardXp(placements, xpMultiplier(bots, placements.length - bots.length));
    live.results = placements.map((placement) => ({
      ...placement,
      ...(ranks.get(placement.id) ?? { rankLevel: 0, rankChange: 0 }),
      bot: live.positions.get(placement.id)?.bot,
      ...(xp.get(placement.id) ?? { xp: null, xpGained: 0 }),
    }));
    io.to(lobby.code).emit("race:ended", { reason, results: live.results });
  }

  // Chaque frappe repousse la fin pour inactivité.
  function resetIdleTimer(lobby: Lobby, live: LiveRace) {
    clearTimeout(live.idleTimer);
    live.idleTimer = setTimeout(() => endRace(lobby, live, "idle"), idleMs);
  }

  // Serveur arrêté : les minuteries des courses en cours ne doivent plus se déclencher.
  httpServer.on("close", () => {
    for (const live of liveRaces.values()) stopTimers(live);
  });

  // La course finit quand plus personne ne court : un absent compte encore, il peut revenir (CRS-6).
  async function endIfNobodyRacing(lobby: Lobby, live: LiveRace) {
    const states = [...live.players.values()].map((player) => player.state);
    if (states.every((state) => state === "finished" || state === "abandoned")) {
      await endRace(lobby, live, "allFinished");
    }
  }

  // Nouvelle saisie d'un coureur (joueur ou bot) ; la course finit quand tous ont tapé tout le texte (CRS-5).
  async function updateProgress(
    lobby: Lobby,
    live: LiveRace,
    id: string,
    progress: ProgressMessage,
  ) {
    const player = live.players.get(id)!;
    resetIdleTimer(lobby, live);
    // Une fois fini, sa saisie ne change plus (ex. renvoyée après une reconnexion).
    if (player.state !== "connected") return;
    player.typed = progress.typed;
    player.errors = progress.errors;
    player.keys = progress.keys;
    player.keyErrors = progress.keyErrors;
    for (const sentence of completedSentences(live.content, player.typed)) {
      if (player.sentences.has(sentence)) continue;
      player.sentences.add(sentence);
      const scored = shotRandom() < goalChance;
      io.to(lobby.code).emit("race:shot", { id, sequence: sentence, scored });
      const timer = setTimeout(() => {
        live.shotTimers.delete(timer);
        if (!scored || live.state !== "racing" || player.state === "finished" || player.state === "abandoned") return;
        const range = thirdWordAhead(live.content, player.typed.length, player.removed);
        if (!range) return;
        player.removed.push(range);
        const message = { removed: player.removed, word: live.content.slice(range.start, range.end).trim() };
        for (const client of io.sockets.sockets.values()) {
          if (client.data.user.id === id && client.rooms.has(lobby.code)) client.emit("race:goal", message);
        }
      }, shotMs);
      live.shotTimers.add(timer);
    }
    const racer = live.positions.get(id)!;
    if (racer.position !== player.typed.length) {
      live.positions.set(id, {
        ...racer,
        position: player.typed.length,
        at: Date.now(),
      });
      live.positionsChanged = true;
    }
    if (player.typed.length === live.content.length) {
      player.state = nextPlayerState(player.state, "finish");
      player.doneAt = Date.now();
      await endIfNobodyRacing(lobby, live);
    }
  }

  // Le bot tape une touche à la fois, à la vitesse de son niveau, jusqu'à la fin du texte (BOT-2).
  function driveBot(lobby: Lobby, live: LiveRace, id: string, bot: Bot) {
    const player = live.players.get(id)!;
    const key = botKey(bot.level, { ...player, blocked: false }, live.content, live.errorMode);
    const timer = setTimeout(async () => {
      if (live.state !== "racing") return;
      await updateProgress(lobby, live, id, key.typing);
      if (player.state === "connected") driveBot(lobby, live, id, bot);
    }, key.delayMs / botSpeedup);
    live.botTimers.set(id, timer);
  }

  async function sendParticipants(lobby: Lobby) {
    io.to(lobby.code).emit("lobby:participants", {
      participants: await roomParticipants(lobby),
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
      const participants = await roomParticipants(lobby);
      const present = participants.some((participant) => participant.id === socket.data.user.id);
      if (participants.length >= MAX_PARTICIPANTS && !present) {
        ack?.({ ok: false, error: "lobbyFull" });
        return;
      }

      // Pendant le compte à rebours ou la course, on n'entre plus (SALLE-09), sauf un coureur
      // qui revient (CRS-6), l'hôte qui regarde (LOB-8) ou quelqu'un déjà présent (autre onglet).
      const race = liveRaces.get(lobby.id);
      if (
        (race?.state === "countdown" || race?.state === "racing") &&
        !race.players.has(socket.data.user.id) &&
        lobby.hostId !== socket.data.user.id &&
        !present
      ) {
        ack?.({ ok: false, error: "raceInProgress" });
        return;
      }

      socket.data.lobby = lobby;
      await addParticipant(lobby.id, socket.data.user.id);
      await socket.join(lobby.code);
      await sendParticipants(lobby);

      // Un coureur qui revient reprend la course (CRS-6) ; l'hôte qui regarde la suit sans courir.
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
            removed: player.removed,
          },
        });
        socket.emit("race:positions", ranking(race));
      } else if (race?.endReason && race.results) {
        socket.emit("race:positions", ranking(race));
        socket.emit("race:ended", {
          reason: race.endReason,
          results: race.results,
        });
      }
      ack?.({ ok: true });
    });

    // Seul l'hôte lance la course ; tous reçoivent le même compte à rebours, puis le même texte (CRS-1).
    // L'hôte court avec les autres ou regarde seulement (LOB-8).
    socket.on("race:start", async (payload: unknown, ack?: (response: Ack) => void) => {
      const { user } = socket.data;
      const message = startRaceSchema.safeParse(payload);
      if (!message.success) {
        ack?.({ ok: false, error: "invalidMessage" });
        return;
      }
      // Relu à chaque départ : l'hôte a pu changer les réglages avant de relancer (LOB-9).
      const lobby = socket.data.lobby && (await findOpenLobby(socket.data.lobby.code));
      if (!lobby) {
        ack?.({ ok: false, error: "lobbyNotFound" });
        return;
      }
      if (lobby.hostId !== user.id) {
        ack?.({ ok: false, error: "notHost" });
        return;
      }
      const racers = (await roomParticipants(lobby)).filter(
        (participant) => !(message.data.watch && participant.id === user.id),
      );
      if (racers.length < MIN_RACERS) {
        ack?.({ ok: false, error: "notEnoughParticipants" });
        return;
      }
      // Les bots comptent dans le minimum, mais il faut au moins un humain qui court (COURSE-02).
      if (racers.every((racer) => racer.bot)) {
        ack?.({ ok: false, error: "noHumanRacer" });
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
        startedAt: 0,
        content: "",
        errorMode: lobby.errorMode,
        racerIds: racers.map((racer) => racer.id),
        timeLimitSeconds: null,
        endsAt: null,
        players: new Map(
          racers.map((racer) => [
            racer.id,
            {
              state: "connected",
              typed: "",
              errors: 0,
              keys: 0,
              keyErrors: {},
              removed: [],
              sentences: new Set<number>(),
            },
          ]),
        ),
        positions: new Map(),
        positionsChanged: false,
        shotTimers: new Set(),
        botTimers: new Map(),
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

      io.to(lobby.code).emit("race:countdown", {
        seconds: Math.ceil(countdownMs / 1000),
      });
      ack?.({ ok: true });

      setTimeout(async () => {
        live.state = nextLobbyState(live.state, "countdownEnd");
        live.startedAt = Date.now();
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
        for (const { id, username, bot } of racers) {
          live.positions.set(id, {
            username,
            position: 0,
            at: Date.now(),
            bot,
          });
        }
        live.positionsChanged = true;
        sendPositions(lobby, live);
        live.positionsTimer = setInterval(() => sendPositions(lobby, live), positionsMs);
        for (const { id, bot } of racers) if (bot) driveBot(lobby, live, id, bot);
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

      await updateProgress(lobby, live, user.id, result.data);
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
      player.doneAt = Date.now();
      await endIfNobodyRacing(lobby, live);
      ack?.({ ok: true });
    });

    // Dans la salle d'attente, l'hôte ajoute un bot du niveau choisi (BOT-1, BOT-2).
    socket.on("lobby:addBot", async (payload: unknown, ack?: (response: Ack) => void) => {
      const { lobby, user } = socket.data;
      const message = addBotSchema.safeParse(payload);
      if (!message.success) {
        ack?.({ ok: false, error: "invalidMessage" });
        return;
      }
      if (!lobby) {
        ack?.({ ok: false, error: "lobbyNotFound" });
        return;
      }
      if (lobby.hostId !== user.id) {
        ack?.({ ok: false, error: "notHost" });
        return;
      }
      if (liveRaces.has(lobby.id)) {
        ack?.({ ok: false, error: "raceInProgress" });
        return;
      }
      if ((await roomParticipants(lobby)).length >= MAX_PARTICIPANTS) {
        ack?.({ ok: false, error: "lobbyFull" });
        return;
      }

      // Numéro suivant parmi les bots de ce niveau : « Bot Expert 1 », « Bot Expert 2 »…
      const bots = lobbyBots.get(lobby.id) ?? [];
      const { level } = message.data;
      const number =
        Math.max(0, ...bots.filter(({ bot }) => bot.level === level).map(({ bot }) => bot.number)) +
        1;
      lobbyBots.set(lobby.id, [
        ...bots,
        {
          id: randomUUID(),
          username: `Bot ${level} ${number}`,
          bot: { level, number },
        },
      ]);
      await sendParticipants(lobby);
      ack?.({ ok: true });
    });

    socket.on("lobby:removeBot", async (payload: unknown, ack?: (response: Ack) => void) => {
      const { lobby, user } = socket.data;
      const message = removeBotSchema.safeParse(payload);
      if (!message.success) {
        ack?.({ ok: false, error: "invalidMessage" });
        return;
      }
      if (!lobby) {
        ack?.({ ok: false, error: "lobbyNotFound" });
        return;
      }
      if (lobby.hostId !== user.id) {
        ack?.({ ok: false, error: "notHost" });
        return;
      }
      if (liveRaces.has(lobby.id)) {
        ack?.({ ok: false, error: "raceInProgress" });
        return;
      }
      const bots = lobbyBots.get(lobby.id) ?? [];
      if (!bots.some((bot) => bot.id === message.data.id)) {
        ack?.({ ok: false, error: "botNotFound" });
        return;
      }

      lobbyBots.set(
        lobby.id,
        bots.filter((bot) => bot.id !== message.data.id),
      );
      await sendParticipants(lobby);
      ack?.({ ok: true });
    });

    // Après une course, l'hôte relance le même lobby : tous reviennent à la salle d'attente (LOB-9).
    socket.on("lobby:restart", async (ack?: (response: Ack) => void) => {
      const { lobby, user } = socket.data;
      if (!lobby) {
        ack?.({ ok: false, error: "lobbyNotFound" });
        return;
      }
      if (lobby.hostId !== user.id) {
        ack?.({ ok: false, error: "notHost" });
        return;
      }
      // Seulement après la fin d'une course (#3).
      if (!canDo(lobby, "restart")) {
        ack?.({ ok: false, error: "raceNotFinished" });
        return;
      }

      liveRaces.delete(lobby.id);
      io.to(lobby.code).emit("lobby:restarted");
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
      lobbyBots.delete(lobby.id);
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
