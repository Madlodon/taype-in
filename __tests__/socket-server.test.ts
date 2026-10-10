// @vitest-environment node
import { completedSentences, thirdWordAhead } from "../lib/race-goals";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Server } from "socket.io";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";
import { lobbies, lobbyParticipants, races, results, users } from "../db/schema";
import { createSession } from "../lib/auth";
import {
  claimInvite,
  createInvites,
  createLobby,
  findOpenLobby,
  listParticipants,
  updateLobbySettings,
} from "../lib/lobbies";
import { CODE_ATTEMPT_LIMIT } from "../lib/rate-limit";
import { createSocketServer } from "../lib/socket-server";
import type {
  Ack,
  CountdownMessage,
  ExplorerLobby,
  LobbiesMessage,
  ParticipantsMessage,
  RaceEndedMessage,
  RacePositionsMessage,
  RaceStartedMessage,
  RaceShotMessage,
  RaceGoalMessage,
} from "../lib/socket-messages";

let io: Server;
let url: string;
const clients: Socket[] = [];
// Utilisateurs créés par un test, supprimés après (avec leurs lobbys).
const createdIds: string[] = [];

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "db/migrations" });
});

// Compte à rebours raccourci et bots accélérés pour garder les tests rapides.
async function startServer(
  options: {
    countdownMs?: number;
    idleMs?: number;
    shotMs?: number;
    shotRandom?: () => number;
    goalChance?: number;
    hostGraceMs?: number;
    maxWpm?: number;
    giveUpMs?: number;
    wpmSampleMs?: number;
  } = {},
) {
  const httpServer = createServer();
  // Les tests envoient tout le texte d'un coup : la limite de vitesse est levée sauf pour l'anti-triche.
  io = createSocketServer(httpServer, { countdownMs: 100, botSpeedup: 1000, maxWpm: Infinity, ...options });
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
}

beforeEach(async () => {
  await startServer();
});

afterEach(async () => {
  clients.forEach((client) => client.disconnect());
  clients.length = 0;
  await io.close();
  if (createdIds.length === 0) return;
  const ids = createdIds.splice(0);
  await db.delete(lobbies).where(inArray(lobbies.hostId, ids));
  await db.delete(users).where(inArray(users.id, ids));
});

afterAll(async () => {
  // io.close() lance les gestionnaires « disconnect » sans les attendre ; ils font encore
  // des requêtes (participants) : on les laisse finir avant de fermer la base.
  await new Promise((resolve) => setTimeout(resolve, 200));
  await db.$client.end();
});

async function newUser() {
  const [user] = await db
    .insert(users)
    .values({ username: `t_${Math.random().toString(36).slice(2, 12)}` })
    .returning();
  createdIds.push(user.id);
  return user;
}

// Remplit un lobby jusqu'à `total` participants sans ouvrir de sockets.
async function fillLobby(lobbyId: string, total: number) {
  const rows = await db
    .insert(users)
    .values(
      Array.from({ length: total }, () => ({
        username: `t_${Math.random().toString(36).slice(2, 12)}`,
      })),
    )
    .returning({ id: users.id });
  createdIds.push(...rows.map((row) => row.id));
  await db.insert(lobbyParticipants).values(rows.map((row) => ({ lobbyId, userId: row.id })));
  return rows;
}

function open(cookie?: string): Socket {
  const client = connect(url, {
    transports: ["websocket"],
    extraHeaders: cookie ? { cookie } : {},
  });
  clients.push(client);
  return client;
}

async function newClient(user?: { id: string }): Promise<Socket> {
  const { token } = await createSession((user ?? (await newUser())).id);
  const client = open(`autre=1; session=${token}`);
  await new Promise<void>((resolve) => client.on("connect", resolve));
  return client;
}

function join(client: Socket, payload: unknown): Promise<Ack> {
  return client.emitWithAck("lobby:join", payload);
}

function nextParticipants(client: Socket): Promise<ParticipantsMessage> {
  return new Promise((resolve) => client.once("lobby:participants", resolve));
}

describe("connexion", () => {
  test.each([
    ["no cookie", undefined],
    ["unknown session", "session=inconnu"],
  ])("Should_RefuseConnection_When_%s", async (_, cookie) => {
    const client = open(cookie);

    const error = await new Promise<Error>((resolve) => client.on("connect_error", resolve));

    expect(error.message).toBe("notLoggedIn");
  });
});

describe("lobby:join", () => {
  test("Should_AckOk_When_LobbyExists", async () => {
    const host = await newUser();
    const lobby = await createLobby(host.id, "unlisted");
    const client = await newClient(host);

    expect(await join(client, { code: lobby.code })).toEqual({ ok: true });
  });

  test("Should_AckOk_When_CodeIsLowercase", async () => {
    const lobby = await createLobby((await newUser()).id, "unlisted");
    const client = await newClient();

    expect(await join(client, { code: lobby.code.toLowerCase() })).toEqual({ ok: true });
  });

  test("Should_AckError_When_LobbyDoesNotExist", async () => {
    const client = await newClient();

    expect(await join(client, { code: "ZZZZZZZ" })).toEqual({
      ok: false,
      error: "lobbyNotFound",
    });
  });

  test("Should_AckError_When_LobbyIsPrivateAndUserHasNoInvite", async () => {
    const lobby = await createLobby((await newUser()).id, "private");
    const client = await newClient();

    expect(await join(client, { code: lobby.code })).toEqual({
      ok: false,
      error: "lobbyNotFound",
    });
    expect(await listParticipants(lobby.id)).toEqual([]);
  });

  test("Should_AckTooManyAttempts_When_IpFailedTooManyCodes", async () => {
    const lobby = await createLobby((await newUser()).id, "unlisted");
    const { token } = await createSession((await newUser()).id);
    const client = connect(url, {
      transports: ["websocket"],
      extraHeaders: { cookie: `session=${token}`, "x-forwarded-for": "198.51.100.42" },
    });
    clients.push(client);
    for (let i = 0; i < CODE_ATTEMPT_LIMIT; i++) await join(client, { code: "ZZZZZZZ" });

    expect(await join(client, { code: lobby.code })).toEqual({
      ok: false,
      error: "tooManyAttempts",
    });
  });

  test("Should_AckOk_When_UserUsedAnInviteToPrivateLobby", async () => {
    const lobby = await createLobby((await newUser()).id, "private");
    const [token] = await createInvites(lobby.id, 1);
    const student = await newUser();
    await claimInvite(token, student.id, "203.0.113.1");
    const client = await newClient(student);

    expect(await join(client, { code: lobby.code })).toEqual({ ok: true });
  });

  test.each([
    ["no payload", undefined],
    ["missing code", {}],
    ["empty code", { code: "" }],
    ["blank code", { code: "   " }],
    ["code too long", { code: "A".repeat(17) }],
    ["code not a string", { code: 123 }],
  ])("Should_AckError_When_%s", async (_, payload) => {
    const client = await newClient();

    expect(await join(client, payload)).toEqual({ ok: false, error: "invalidMessage" });
  });

  test("Should_AckLobbyFull_When_LobbyReachedItsCapacity", async () => {
    const lobby = await createLobby((await newUser()).id, "unlisted", { capacity: 4 });
    await fillLobby(lobby.id, 4);

    expect(await join(await newClient(), { code: lobby.code })).toEqual({
      ok: false,
      error: "lobbyFull",
    });
  });

  test("Should_AckOk_When_LobbyHasOneSeatLeft", async () => {
    const lobby = await createLobby((await newUser()).id, "unlisted", { capacity: 4 });
    await fillLobby(lobby.id, 3);

    expect(await join(await newClient(), { code: lobby.code })).toEqual({ ok: true });
  });

  test("Should_AckLobbyFull_When_DefaultCapacityOf30IsReached", async () => {
    const lobby = await createLobby((await newUser()).id, "unlisted");
    await fillLobby(lobby.id, 30);

    expect(await join(await newClient(), { code: lobby.code })).toEqual({
      ok: false,
      error: "lobbyFull",
    });
  });

  test("Should_AckOk_When_LobbyIsFullButPlayerIsAlreadyIn", async () => {
    const lobby = await createLobby((await newUser()).id, "unlisted", { capacity: 2 });
    const [first] = await fillLobby(lobby.id, 2);

    expect(await join(await newClient(first), { code: lobby.code })).toEqual({ ok: true });
  });

  test("Should_AckLobbyFull_When_HostLoweredCapacityBelowPeopleInRoom", async () => {
    const { lobby } = await lobbyWithTwo();
    await updateLobbySettings(lobby.id, {
      textLanguage: "fr",
      textLength: 100,
      errorMode: "blocking",
      timeLimitSeconds: 300,
      capacity: 2,
    });

    expect(await join(await newClient(), { code: lobby.code })).toEqual({
      ok: false,
      error: "lobbyFull",
    });
  });

  test("Should_KeepEveryone_When_HostLoweredCapacityBelowPeopleInRoom", async () => {
    const { lobby } = await lobbyWithTwo({ capacity: 3 });
    await join(await newClient(), { code: lobby.code });
    await updateLobbySettings(lobby.id, {
      textLanguage: "fr",
      textLength: 100,
      errorMode: "blocking",
      timeLimitSeconds: 300,
      capacity: 2,
    });

    expect(await listParticipants(lobby.id)).toHaveLength(3);
  });

  test("Should_LeaveWatchingHostOutOfRacers_When_LobbyIsFull", async () => {
    const { host, hostClient, guestClient, lobby } = await lobbyWithTwo({ capacity: 3 });
    const third = await newClient();
    await join(third, { code: lobby.code });
    const guestSees = next<RaceStartedMessage>(guestClient, "race:started");

    expect(await hostClient.emitWithAck("race:start", { watch: true })).toEqual({ ok: true });

    const { racerIds } = await guestSees;
    expect(racerIds).toHaveLength(2);
    expect(racerIds).not.toContain(host.id);
  });

  test("Should_SendParticipantListToEveryone_When_PlayerJoins", async () => {
    const host = await newUser();
    const guest = await newUser();
    const lobby = await createLobby(host.id, "unlisted");
    const hostClient = await newClient(host);
    await join(hostClient, { code: lobby.code });
    const hostSees = nextParticipants(hostClient);
    const guestClient = await newClient(guest);
    const guestSees = nextParticipants(guestClient);

    await join(guestClient, { code: lobby.code });

    const expected = {
      hostId: host.id,
      participants: [
        { id: host.id, username: host.username },
        { id: guest.id, username: guest.username },
      ],
    };
    expect(await hostSees).toEqual(expected);
    expect(await guestSees).toEqual(expected);
  });

  test("Should_NotNotify_When_PlayerJoinsOtherLobby", async () => {
    const host = await newUser();
    const first = await createLobby(host.id, "unlisted");
    const second = await createLobby(host.id, "unlisted");
    const hostClient = await newClient(host);
    await join(hostClient, { code: first.code });
    let notified = false;
    hostClient.on("lobby:participants", () => (notified = true));

    await join(await newClient(), { code: second.code });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(notified).toBe(false);
  });
});


// SALLE-06 : une personne n'est que dans un lobby à la fois.
describe("one lobby at a time", () => {
  // La personne est dans un premier lobby avec son hôte, un second lobby l'attend.
  async function inOneLobby() {
    const host = await newUser();
    const player = await newUser();
    const first = await createLobby(host.id, "unlisted");
    const second = await createLobby((await newUser()).id, "unlisted");
    const hostClient = await newClient(host);
    await join(hostClient, { code: first.code });
    const firstTab = await newClient(player);
    await join(firstTab, { code: first.code });
    return { host, player, first, second, hostClient, firstTab };
  }

  test("Should_AckInOtherLobby_When_PlayerJoinsAnotherLobbyWithoutLeaving", async () => {
    const { player, first, second } = await inOneLobby();

    const ack = await join(await newClient(player), { code: second.code });

    expect(ack).toEqual({ ok: false, error: "inOtherLobby" });
    expect((await listParticipants(first.id)).map((p) => p.id)).toContain(player.id);
    expect(await listParticipants(second.id)).toEqual([]);
  });

  test("Should_MovePlayer_When_PlayerAcceptsToLeave", async () => {
    const { host, player, first, second, hostClient } = await inOneLobby();
    const hostSees = nextParticipants(hostClient);

    const ack = await join(await newClient(player), { code: second.code, leave: true });

    expect(ack).toEqual({ ok: true });
    expect(await hostSees).toEqual({
      hostId: host.id,
      participants: [{ id: host.id, username: host.username }],
    });
    expect(await listParticipants(first.id)).toEqual([{ id: host.id, username: host.username }]);
    expect(await listParticipants(second.id)).toEqual([
      { id: player.id, username: player.username },
    ]);
  });

  test("Should_TellOldTab_When_PlayerLeavesForAnotherLobby", async () => {
    const { player, second, firstTab } = await inOneLobby();
    const left = next(firstTab, "lobby:left");

    await join(await newClient(player), { code: second.code, leave: true });

    await expect(left).resolves.toBeUndefined();
  });

  test("Should_StayInNewLobby_When_OldTabCloses", async () => {
    const { player, second, firstTab } = await inOneLobby();
    await join(await newClient(player), { code: second.code, leave: true });

    firstTab.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect((await listParticipants(second.id)).map((p) => p.id)).toEqual([player.id]);
  });

  test("Should_JoinWithoutAsking_When_OtherLobbyIsClosed", async () => {
    const { player, first, second } = await inOneLobby();
    await db.update(lobbies).set({ closedAt: new Date() }).where(eq(lobbies.id, first.id));

    expect(await join(await newClient(player), { code: second.code })).toEqual({ ok: true });
  });

  test("Should_ListPlayerOnce_When_SecondTabJoinsSameLobby", async () => {
    const { player, first } = await inOneLobby();

    const ack = await join(await newClient(player), { code: first.code });

    expect(ack).toEqual({ ok: true });
    expect((await listParticipants(first.id)).filter((p) => p.id === player.id)).toHaveLength(1);
  });

  test("Should_AckInvalidMessage_When_LeaveIsNotABoolean", async () => {
    const { player, second } = await inOneLobby();

    expect(await join(await newClient(player), { code: second.code, leave: "yes" })).toEqual({
      ok: false,
      error: "invalidMessage",
    });
  });
});

function next<T>(client: Socket, event: string): Promise<T> {
  return new Promise((resolve) => client.once(event, resolve));
}

// Un hôte et un invité dans le même lobby, prêts à courir.
async function lobbyWithTwo(settings?: Parameters<typeof createLobby>[2]) {
  const host = await newUser();
  const guest = await newUser();
  const lobby = await createLobby(host.id, "unlisted", settings);
  const hostClient = await newClient(host);
  await join(hostClient, { code: lobby.code });
  const guestClient = await newClient(guest);
  await join(guestClient, { code: lobby.code });
  return { host, guest, lobby, hostClient, guestClient };
}

describe("race:start", () => {
  test("Should_SendCountdownWithoutText_When_HostStarts", async () => {
    const { hostClient, guestClient } = await lobbyWithTwo();
    const hostSees = next<CountdownMessage>(hostClient, "race:countdown");
    const guestSees = next<CountdownMessage>(guestClient, "race:countdown");
    const started = next(guestClient, "race:started");

    expect(await hostClient.emitWithAck("race:start", { watch: false })).toEqual({ ok: true });

    expect(await hostSees).toEqual({ seconds: 1 });
    expect(await guestSees).toEqual({ seconds: 1 });
    await started;
  });

  test("Should_CountDownThreeSecondsBeforeText_When_DefaultCountdown", async () => {
    await io.close();
    await startServer({ countdownMs: undefined });
    const { hostClient } = await lobbyWithTwo();
    const countdown = next<CountdownMessage>(hostClient, "race:countdown");
    const started = next(hostClient, "race:started");

    const sentAt = Date.now();
    await hostClient.emitWithAck("race:start", { watch: false });

    expect(await countdown).toEqual({ seconds: 3 });
    await started;
    expect(Date.now() - sentAt).toBeGreaterThanOrEqual(2900);
  }, 6000);

  test("Should_SendSameTextToEveryone_When_CountdownEnds", async () => {
    const { host, guest, hostClient, guestClient } = await lobbyWithTwo();
    const hostSees = next<RaceStartedMessage>(hostClient, "race:started");
    const guestSees = next<RaceStartedMessage>(guestClient, "race:started");

    await hostClient.emitWithAck("race:start", { watch: false });

    const message = await hostSees;
    expect(message.content).not.toBe("");
    expect(message.racerIds).toEqual([host.id, guest.id]);
    expect(await guestSees).toEqual(message);
  });

  test.each(["blocking", "tolerant"] as const)(
    "Should_SendLobbyErrorMode_When_LobbyIs_%s",
    async (errorMode) => {
      const { guestClient, hostClient } = await lobbyWithTwo({ errorMode });
      const guestSees = next<RaceStartedMessage>(guestClient, "race:started");

      await hostClient.emitWithAck("race:start", { watch: false });

      expect((await guestSees).errorMode).toBe(errorMode);
    },
  );

  test("Should_SaveRaceWithTextAndStartTime_When_CountdownEnds", async () => {
    const { lobby, hostClient } = await lobbyWithTwo();
    const started = next<RaceStartedMessage>(hostClient, "race:started");

    await hostClient.emitWithAck("race:start", { watch: false });
    const { content } = await started;

    const [race] = await db.select().from(races).where(eq(races.lobbyId, lobby.id));
    expect(race.content).toBe(content);
    expect(race.startedAt).not.toBeNull();
  });

  test("Should_AckNotHost_When_PlayerIsNotHost", async () => {
    const { guestClient } = await lobbyWithTwo();

    expect(await guestClient.emitWithAck("race:start", { watch: false })).toEqual({
      ok: false,
      error: "notHost",
    });
  });

  test("Should_AckNotEnoughParticipants_When_HostIsAlone", async () => {
    const host = await newUser();
    const lobby = await createLobby(host.id, "unlisted");
    const hostClient = await newClient(host);
    await join(hostClient, { code: lobby.code });

    expect(await hostClient.emitWithAck("race:start", { watch: false })).toEqual({
      ok: false,
      error: "notEnoughParticipants",
    });
  });

  test("Should_AckLobbyNotFound_When_SocketHasNotJoinedALobby", async () => {
    const client = await newClient();

    expect(await client.emitWithAck("race:start", { watch: false })).toEqual({
      ok: false,
      error: "lobbyNotFound",
    });
  });

  test("Should_AckRaceInProgress_When_RaceAlreadyStarted", async () => {
    const { hostClient } = await lobbyWithTwo();
    const started = next(hostClient, "race:started");
    await hostClient.emitWithAck("race:start", { watch: false });

    expect(await hostClient.emitWithAck("race:start", { watch: false })).toEqual({
      ok: false,
      error: "raceInProgress",
    });
    await started;
  });

  test("Should_StartOnce_When_HostStartsTwiceAtTheSameTime", async () => {
    const { lobby, hostClient } = await lobbyWithTwo();
    const started = next(hostClient, "race:started");

    const acks = await Promise.all([
      hostClient.emitWithAck("race:start", { watch: false }),
      hostClient.emitWithAck("race:start", { watch: false }),
    ]);
    await started;

    expect(acks).toContainEqual({ ok: true });
    expect(acks).toContainEqual({ ok: false, error: "raceInProgress" });
    expect(await db.select().from(races).where(eq(races.lobbyId, lobby.id))).toHaveLength(1);
  });

  // SALLE-09 : on n'entre que dans une salle en attente ou sur l'écran des résultats.
  test("Should_RefuseJoin_When_RaceIsCountingDown", async () => {
    const { lobby, hostClient } = await lobbyWithTwo();
    const started = next(hostClient, "race:started");
    await hostClient.emitWithAck("race:start", { watch: false });

    expect(await join(await newClient(), { code: lobby.code })).toEqual({
      ok: false,
      error: "raceInProgress",
    });
    await started;
  });

  test("Should_RefuseJoin_When_RaceIsRunning", async () => {
    const { lobby, hostClient } = await lobbyWithTwo();
    const started = next(hostClient, "race:started");
    await hostClient.emitWithAck("race:start", { watch: false });
    await started;

    expect(await join(await newClient(), { code: lobby.code })).toEqual({
      ok: false,
      error: "raceInProgress",
    });
  });

  test("Should_NotListRefusedPlayer_When_RaceIsRunning", async () => {
    const { lobby, hostClient } = await lobbyWithTwo();
    const started = next(hostClient, "race:started");
    await hostClient.emitWithAck("race:start", { watch: false });
    await started;

    await join(await newClient(), { code: lobby.code });

    expect(await listParticipants(lobby.id)).toHaveLength(2);
  });

  test("Should_SendCountdown_When_RacerComesBackDuringCountdown", async () => {
    const { guest, lobby, hostClient, guestClient } = await lobbyWithTwo();
    const started = next(hostClient, "race:started");
    await hostClient.emitWithAck("race:start", { watch: false });
    const left = nextParticipants(hostClient);
    guestClient.disconnect();
    await left;
    const back = await newClient(guest);
    const backSees = next<CountdownMessage>(back, "race:countdown");

    expect(await join(back, { code: lobby.code })).toEqual({ ok: true });
    expect((await backSees).seconds).toBeGreaterThan(0);
    await started;
  });
});

// Un hôte et deux invités : assez de coureurs sans l'hôte.
async function lobbyWithThree() {
  const { host, guest, lobby, hostClient, guestClient } = await lobbyWithTwo();
  const other = await newUser();
  const otherClient = await newClient(other);
  await join(otherClient, { code: lobby.code });
  return { host, guest, other, lobby, hostClient, guestClient, otherClient };
}

// Lance la course sans que l'hôte coure et attend le « Go ».
async function startWatching(hostClient: Socket): Promise<RaceStartedMessage> {
  const started = next<RaceStartedMessage>(hostClient, "race:started");
  await hostClient.emitWithAck("race:start", { watch: true });
  return started;
}

// L'hôte regarde la course sans courir (LOB-8).
describe("race:start as spectator host", () => {

  test("Should_LeaveHostOutOfRacers_When_HostWatches", async () => {
    const { guest, other, hostClient, guestClient } = await lobbyWithThree();
    const guestSees = next<RaceStartedMessage>(guestClient, "race:started");

    expect(await hostClient.emitWithAck("race:start", { watch: true })).toEqual({ ok: true });

    expect((await guestSees).racerIds).toEqual([guest.id, other.id]);
  });

  test("Should_AckNotEnoughParticipants_When_HostWatchesWithOnlyOneOther", async () => {
    const { hostClient } = await lobbyWithTwo();

    expect(await hostClient.emitWithAck("race:start", { watch: true })).toEqual({
      ok: false,
      error: "notEnoughParticipants",
    });
  });

  test("Should_AckNotRacer_When_SpectatorHostSendsProgress", async () => {
    const { hostClient } = await lobbyWithThree();
    const started = next<RaceStartedMessage>(hostClient, "race:started");
    await hostClient.emitWithAck("race:start", { watch: true });
    const { content } = await started;

    expect(await progress(hostClient, typing(content, 0))).toEqual({
      ok: false,
      error: "notRacer",
    });
  });

  test("Should_EndRaceWithoutHostInResults_When_EveryRacerFinishes", async () => {
    const { host, hostClient, guestClient, otherClient } = await lobbyWithThree();
    const started = next<RaceStartedMessage>(hostClient, "race:started");
    await hostClient.emitWithAck("race:start", { watch: true });
    const { content } = await started;
    const hostSees = next<RaceEndedMessage>(hostClient, "race:ended");

    await progress(guestClient, typing(content, 0));
    await progress(otherClient, typing(content, 0));

    const { reason, results } = await hostSees;
    expect(reason).toBe("allFinished");
    expect(results).toHaveLength(2);
    expect(results.map((result) => result.id)).not.toContain(host.id);
  });

  test.each([undefined, {}, { watch: "yes" }])(
    "Should_AckInvalidMessage_When_PayloadIs_%j",
    async (payload) => {
      const { hostClient } = await lobbyWithTwo();

      expect(await hostClient.emitWithAck("race:start", payload)).toEqual({
        ok: false,
        error: "invalidMessage",
      });
    },
  );
});

// Lance la course et attend le « Go ».
async function startRace(hostClient: Socket): Promise<RaceStartedMessage> {
  const started = next<RaceStartedMessage>(hostClient, "race:started");
  await hostClient.emitWithAck("race:start", { watch: false });
  return started;
}

// Saisie envoyée par un coureur : chaque faute est une touche de plus, notée sous « e ».
function typing(typed: string, errors: number) {
  return { typed, errors, keys: typed.length + errors, keyErrors: errors > 0 ? { e: errors } : {} };
}

function progress(client: Socket, payload: unknown): Promise<Ack> {
  return client.emitWithAck("race:progress", payload);
}

async function savedRace(lobbyId: string) {
  const [race] = await db.select().from(races).where(eq(races.lobbyId, lobbyId));
  return race;
}

describe("race end", () => {
  test("Should_SendTimeLeft_When_RaceStartsWithTimer", async () => {
    const { hostClient } = await lobbyWithTwo({ timeLimitSeconds: 600 });

    expect((await startRace(hostClient)).secondsLeft).toBe(600);
  });

  test("Should_SendNoTimeLeft_When_RaceHasNoTimer", async () => {
    const { hostClient } = await lobbyWithTwo({ timeLimitSeconds: null });

    expect((await startRace(hostClient)).secondsLeft).toBeNull();
  });

  test("Should_SendZeroElapsedTime_When_RaceStarts", async () => {
    const { hostClient } = await lobbyWithTwo();

    expect((await startRace(hostClient)).elapsedMs).toBe(0);
  });

  test("Should_EndRaceForEveryone_When_EveryRacerFinishes", async () => {
    const { lobby, hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    const hostSees = next<RaceEndedMessage>(hostClient, "race:ended");
    const guestSees = next<RaceEndedMessage>(guestClient, "race:ended");

    expect(await progress(hostClient, typing(content, 0))).toEqual({ ok: true });
    await progress(guestClient, typing(content, 0));

    expect(await hostSees).toMatchObject({ reason: "allFinished" });
    expect(await guestSees).toMatchObject({ reason: "allFinished" });
    expect((await savedRace(lobby.id)).endedAt).not.toBeNull();
  });

  test("Should_KeepRacing_When_OnlySomeRacersFinished", async () => {
    const { lobby, hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    let ended = false;
    guestClient.on("race:ended", () => (ended = true));

    await progress(hostClient, typing(content, 0));
    await progress(guestClient, typing(content.slice(0, -1), 0));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(ended).toBe(false);
    expect((await savedRace(lobby.id)).endedAt).toBeNull();
  });

  test("Should_EndRace_When_TimerRunsOut", async () => {
    const { lobby, hostClient, guestClient } = await lobbyWithTwo({ timeLimitSeconds: 1 });
    await startRace(hostClient);
    const guestSees = next<RaceEndedMessage>(guestClient, "race:ended");

    expect(await guestSees).toMatchObject({ reason: "timeUp" });
    expect((await savedRace(lobby.id)).endedAt).not.toBeNull();
  });

  test("Should_EndRace_When_NobodyTypesForIdleLimit", async () => {
    await io.close();
    await startServer({ idleMs: 200 });
    const { lobby, hostClient } = await lobbyWithTwo();
    await startRace(hostClient);

    expect(await next<RaceEndedMessage>(hostClient, "race:ended")).toMatchObject({ reason: "idle" });
    expect((await savedRace(lobby.id)).endedAt).not.toBeNull();
  });

  test("Should_PostponeIdleEnd_When_ARacerTypes", async () => {
    await io.close();
    await startServer({ idleMs: 300 });
    const { hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    let ended = false;
    hostClient.on("race:ended", () => (ended = true));
    const endedLater = next<RaceEndedMessage>(hostClient, "race:ended");

    await new Promise((resolve) => setTimeout(resolve, 200));
    await progress(guestClient, typing(content[0], 0));
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(ended).toBe(false);
    expect(await endedLater).toMatchObject({ reason: "idle" });
  });

  test("Should_TellLatePlayerRaceIsOver_When_JoiningAfterEnd", async () => {
    const { lobby, hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    const ended = next(hostClient, "race:ended");
    await progress(hostClient, typing(content, 0));
    await progress(guestClient, typing(content, 0));
    await ended;
    const late = await newClient();
    const lateSees = next<RaceEndedMessage>(late, "race:ended");

    expect(await join(late, { code: lobby.code })).toEqual({ ok: true });

    expect(await lateSees).toMatchObject({ reason: "allFinished" });
  });

  test("Should_LetHostClose_When_RaceHasEnded", async () => {
    const { lobby, hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    const ended = next(hostClient, "race:ended");
    await progress(hostClient, typing(content, 0));
    await progress(guestClient, typing(content, 0));
    await ended;

    expect(await hostClient.emitWithAck("lobby:close")).toEqual({ ok: true });
    expect(await findOpenLobby(lobby.code)).toBeNull();
  });
});

describe("race results", () => {
  test("Should_SendRankingInFinishOrder_When_EveryRacerFinishes", async () => {
    const { host, guest, hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    const ended = next<RaceEndedMessage>(guestClient, "race:ended");

    await progress(guestClient, typing(content, 2));
    // Assez d'écart pour que les deux temps ne tombent pas dans la même milliseconde.
    await new Promise((resolve) => setTimeout(resolve, 20));
    await progress(hostClient, typing(content, 0));

    const { results: ranked } = await ended;
    expect(ranked.map((result) => [result.id, result.rank, result.finished])).toEqual([
      [guest.id, 1, true],
      [host.id, 2, true],
    ]);
    expect(ranked[0]).toMatchObject({ username: guest.username, errors: 2, keyErrors: { e: 2 } });
    expect(ranked[0].wpm).toBeGreaterThan(0);
    expect(ranked[0].accuracy).toBeLessThan(100);
  });

  test("Should_RankRacerWhoGaveUpLast_When_OtherFinishes", async () => {
    const { host, guest, hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    await progress(guestClient, typing(content.slice(0, 10), 0));
    await giveUp(guestClient);
    const ended = next<RaceEndedMessage>(hostClient, "race:ended");

    await progress(hostClient, typing(content, 0));

    expect((await ended).results.map((result) => [result.id, result.finished])).toEqual([
      [host.id, true],
      [guest.id, false],
    ]);
  });

  test("Should_RankByProgress_When_TimerRunsOut", async () => {
    const { host, guest, hostClient, guestClient } = await lobbyWithTwo({ timeLimitSeconds: 1 });
    const { content } = await startRace(hostClient);
    const ended = next<RaceEndedMessage>(hostClient, "race:ended");

    await progress(hostClient, typing(content.slice(0, 3), 0));
    await progress(guestClient, typing(content.slice(0, 8), 0));

    const { results: ranked } = await ended;
    expect(ranked.map((result) => [result.id, result.finished])).toEqual([
      [guest.id, false],
      [host.id, false],
    ]);
    expect(ranked[0].durationMs).toBeGreaterThanOrEqual(900);
  });

  test("Should_SaveResults_When_RaceEnds", async () => {
    const { lobby, host, guest, hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    const ended = next<RaceEndedMessage>(hostClient, "race:ended");
    await progress(hostClient, typing(content, 0));
    await new Promise((resolve) => setTimeout(resolve, 20));
    await progress(guestClient, typing(content, 1));
    await ended;

    const saved = await db
      .select()
      .from(results)
      .where(eq(results.raceId, (await savedRace(lobby.id)).id));

    expect(saved.map((row) => [row.userId, row.rank, row.errorCount, row.keyErrors])).toEqual(
      expect.arrayContaining([
        [host.id, 1, 0, {}],
        [guest.id, 2, 1, { e: 1 }],
      ]),
    );
  });

  test("Should_MoveWinnerUpAndLoserDown_When_TwoRacersFinish", async () => {
    const { host, guest, hostClient, guestClient } = await lobbyWithTwo();
    await db.update(users).set({ rankLevel: 10 }).where(inArray(users.id, [host.id, guest.id]));
    const { content } = await startRace(hostClient);
    const ended = next<RaceEndedMessage>(hostClient, "race:ended");
    await progress(hostClient, typing(content, 0));
    await new Promise((resolve) => setTimeout(resolve, 20));
    await progress(guestClient, typing(content, 0));

    const { results: ranked } = await ended;

    expect(ranked.map((result) => [result.id, result.rankLevel, result.rankChange])).toEqual([
      [host.id, 11, 1],
      [guest.id, 9, -1],
    ]);
    const saved = await db
      .select({ id: users.id, rankLevel: users.rankLevel })
      .from(users)
      .where(inArray(users.id, [host.id, guest.id]));
    expect(saved).toEqual(
      expect.arrayContaining([
        { id: host.id, rankLevel: 11 },
        { id: guest.id, rankLevel: 9 },
      ]),
    );
  });

  test("Should_SendXpGained_When_TwoRacersFinish", async () => {
    const { host, guest, hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    const ended = next<RaceEndedMessage>(hostClient, "race:ended");
    await progress(hostClient, typing(content, 0));
    await new Promise((resolve) => setTimeout(resolve, 20));
    await progress(guestClient, typing(content, 0));

    const { results: ranked } = await ended;

    expect(ranked.map((result) => [result.id, result.xp, result.xpGained])).toEqual([
      [host.id, 100, 100],
      [guest.id, 20, 20],
    ]);
  });

  test("Should_RecordWpmEverySampleUntilRacerFinishes_When_RaceRuns", async () => {
    await io.close();
    await startServer({ wpmSampleMs: 50 });
    const { host, guest, hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    const ended = next<RaceEndedMessage>(hostClient, "race:ended");
    await progress(hostClient, typing(content.slice(0, 10), 0));
    await new Promise((resolve) => setTimeout(resolve, 180));
    await progress(hostClient, typing(content, 0));
    await new Promise((resolve) => setTimeout(resolve, 180));
    await progress(guestClient, typing(content, 0));

    const { results: ranked } = await ended;
    const series = (id: string) => ranked.find((result) => result.id === id)!.wpmSeries;

    expect(series(host.id).length).toBeGreaterThanOrEqual(2);
    expect(series(host.id).every((wpm) => wpm > 0)).toBe(true);
    // Le premier a fini plus tôt : sa série s'arrête là, celle de l'autre continue.
    expect(series(guest.id).length).toBeGreaterThan(series(host.id).length);
    expect(series(guest.id)[0]).toBe(0);
  });

  test("Should_SaveWpmSeries_When_RaceEnds", async () => {
    await io.close();
    await startServer({ wpmSampleMs: 50 });
    const { lobby, host, hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    const ended = next<RaceEndedMessage>(hostClient, "race:ended");
    await new Promise((resolve) => setTimeout(resolve, 120));
    await progress(hostClient, typing(content, 0));
    await progress(guestClient, typing(content, 0));
    const { results: ranked } = await ended;

    const [saved] = await db
      .select({ wpmSeries: results.wpmSeries })
      .from(results)
      .where(and(eq(results.raceId, (await savedRace(lobby.id)).id), eq(results.userId, host.id)));

    expect(saved.wpmSeries.length).toBeGreaterThan(0);
    expect(saved.wpmSeries).toEqual(ranked.find((result) => result.id === host.id)!.wpmSeries);
  });

  test("Should_SendResults_When_JoiningAfterEnd", async () => {
    const { lobby, hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    const ended = next(hostClient, "race:ended");
    await progress(hostClient, typing(content, 0));
    await progress(guestClient, typing(content, 0));
    await ended;
    const late = await newClient();
    const lateSees = next<RaceEndedMessage>(late, "race:ended");

    await join(late, { code: lobby.code });

    expect((await lateSees).results).toHaveLength(2);
  });
});

describe("race:progress", () => {
  test("Should_AckRaceNotRunning_When_RaceHasNotStarted", async () => {
    const { hostClient } = await lobbyWithTwo();

    expect(await progress(hostClient, typing("U", 0))).toEqual({
      ok: false,
      error: "raceNotRunning",
    });
  });

  test("Should_AckRaceNotRunning_When_SocketHasNotJoinedALobby", async () => {
    expect(await progress(await newClient(), typing("U", 0))).toEqual({
      ok: false,
      error: "raceNotRunning",
    });
  });

  test("Should_AckInvalidMessage_When_TypedIsLongerThanTheText", async () => {
    const { hostClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);

    expect(await progress(hostClient, typing(`${content}x`, 0))).toEqual({
      ok: false,
      error: "invalidMessage",
    });
  });

  test.each([
    ["no payload", undefined],
    ["typed not a string", { ...typing("U", 0), typed: 3 }],
    ["missing errors", { typed: "U" }],
    ["negative errors", typing("U", -1)],
    ["decimal errors", typing("U", 1.5)],
    ["missing keys", { typed: "U", errors: 0, keyErrors: {} }],
    ["negative keys", { ...typing("U", 0), keys: -1 }],
    ["missing keyErrors", { typed: "U", errors: 0, keys: 1 }],
    ["key errors not a number", { ...typing("U", 1), keyErrors: { e: "1" } }],
  ])("Should_AckInvalidMessage_When_%s", async (_, payload) => {
    const { hostClient } = await lobbyWithTwo();
    await startRace(hostClient);

    expect(await progress(hostClient, payload)).toEqual({ ok: false, error: "invalidMessage" });
  });

  describe("anti-cheat", () => {
    beforeEach(async () => {
      await io.close();
      await startServer({ maxWpm: 300 });
    });

    test("Should_AckOk_When_ProgressIsHuman", async () => {
      const { hostClient } = await lobbyWithTwo();
      const { content } = await startRace(hostClient);

      expect(await progress(hostClient, typing(content.slice(0, 3), 0))).toEqual({ ok: true });
    });

    test("Should_AckImpossibleProgress_When_WholeTextArrivesRightAfterGo", async () => {
      const { hostClient } = await lobbyWithTwo();
      const { content } = await startRace(hostClient);

      expect(await progress(hostClient, typing(content, 0))).toEqual({
        ok: false,
        error: "impossibleProgress",
      });
    });

    test("Should_AckImpossibleProgress_When_TypedJumpsAheadWithoutKeys", async () => {
      const { hostClient } = await lobbyWithTwo();
      const { content } = await startRace(hostClient);

      expect(await progress(hostClient, { ...typing(content.slice(0, 8), 0), keys: 1 })).toEqual({
        ok: false,
        error: "impossibleProgress",
      });
    });

    test("Should_KeepRaceRunning_When_UpdateIsRejected", async () => {
      const { lobby, hostClient } = await lobbyWithTwo();
      const { content } = await startRace(hostClient);
      await progress(hostClient, typing(content.slice(0, 2), 0));
      await progress(hostClient, typing(content, 0));

      // Le texte complet a été refusé : rien n'est fini et la saisie suivante repart de l'ancienne.
      expect((await savedRace(lobby.id)).endedAt).toBeNull();
      expect(await progress(hostClient, typing(content.slice(0, 3), 0))).toEqual({ ok: true });
    });
  });
});

function giveUp(client: Socket): Promise<Ack> {
  return client.emitWithAck("race:giveUp");
}

// Coupe la connexion de l'invité et attend que le serveur l'ait vu partir.
async function dropGuest(hostClient: Socket, guestClient: Socket) {
  const left = nextParticipants(hostClient);
  guestClient.disconnect();
  await left;
}

// L'invité revient dans un nouvel onglet ; renvoie ce que le serveur lui envoie au retour.
async function guestComesBack(lobby: { code: string }, guest: { id: string }) {
  const client = await newClient(guest);
  const sees = next<RaceStartedMessage>(client, "race:started");
  await join(client, { code: lobby.code });
  return { client, started: await sees };
}

describe("reconnect", () => {
  test("Should_SendTypedTextAndErrors_When_RacerComesBackMidWord", async () => {
    const { guest, lobby, hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    await progress(guestClient, typing(content.slice(0, 5), 2));
    await dropGuest(hostClient, guestClient);

    const { started } = await guestComesBack(lobby, guest);

    expect(started.mine).toEqual({ ...typing(content.slice(0, 5), 2), gaveUp: false, removed: [] });
  });

  test("Should_SendElapsedTime_When_RacerComesBack", async () => {
    const { guest, lobby, hostClient, guestClient } = await lobbyWithTwo();
    await startRace(hostClient);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await dropGuest(hostClient, guestClient);

    const { started } = await guestComesBack(lobby, guest);

    expect(started.elapsedMs).toBeGreaterThanOrEqual(50);
  });

  test("Should_KeepTolerantMistakes_When_RacerComesBack", async () => {
    const { guest, lobby, hostClient, guestClient } = await lobbyWithTwo({
      errorMode: "tolerant",
    });
    await startRace(hostClient);
    await progress(guestClient, typing("Xx", 2));
    await dropGuest(hostClient, guestClient);

    const { started } = await guestComesBack(lobby, guest);

    expect(started.mine?.typed).toBe("Xx");
  });

  test("Should_SendTextWithoutOwnProgress_When_SpectatorHostComesBack", async () => {
    const { host, guest, other, lobby, hostClient } = await lobbyWithThree();
    const { content } = await startWatching(hostClient);
    hostClient.disconnect();
    const back = await newClient(host);
    const backSees = next<RaceStartedMessage>(back, "race:started");

    expect(await join(back, { code: lobby.code })).toEqual({ ok: true });

    expect(await backSees).toMatchObject({ content, racerIds: [guest.id, other.id] });
    expect((await backSees).mine).toBeUndefined();
  });

  test("Should_KeepRacing_When_OnlyADisconnectedRacerHasNotFinished", async () => {
    const { lobby, hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    let ended = false;
    hostClient.on("race:ended", () => (ended = true));
    await dropGuest(hostClient, guestClient);

    await progress(hostClient, typing(content, 0));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(ended).toBe(false);
    expect((await savedRace(lobby.id)).endedAt).toBeNull();
  });

  test("Should_EndRace_When_ReturningRacerFinishes", async () => {
    const { guest, lobby, hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    await progress(hostClient, typing(content, 0));
    await dropGuest(hostClient, guestClient);
    const { client } = await guestComesBack(lobby, guest);
    const ended = next<RaceEndedMessage>(hostClient, "race:ended");

    expect(await progress(client, typing(content, 0))).toEqual({ ok: true });

    expect(await ended).toMatchObject({ reason: "allFinished" });
  });
});

// COURSE-08 : 30 s pour revenir, raccourcies ici.
describe("give up after disconnect", () => {
  test("Should_ResumeRacing_When_RacerComesBackBeforeDelay", async () => {
    await startServer({ giveUpMs: 300 });
    const { guest, lobby, hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    await progress(guestClient, typing(content.slice(0, 3), 0));
    await dropGuest(hostClient, guestClient);

    const { client, started } = await guestComesBack(lobby, guest);
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(started.mine).toMatchObject({ typed: content.slice(0, 3), gaveUp: false });
    expect(await progress(client, typing(content.slice(0, 4), 0))).toEqual({ ok: true });
  });

  test("Should_GiveUp_When_RacerStaysAwayPastDelay", async () => {
    await startServer({ giveUpMs: 50 });
    const { guest, lobby, hostClient, guestClient } = await lobbyWithTwo();
    await startRace(hostClient);
    await dropGuest(hostClient, guestClient);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const { client, started } = await guestComesBack(lobby, guest);

    expect(started.mine?.gaveUp).toBe(true);
    expect(await progress(client, typing("U", 0))).toEqual({ ok: false, error: "notRacer" });
  });

  test("Should_EndRace_When_OnlyAbsentRacerGivesUpAfterDelay", async () => {
    await startServer({ giveUpMs: 50 });
    const { hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    await progress(hostClient, typing(content, 0));
    const ended = next<RaceEndedMessage>(hostClient, "race:ended");

    await dropGuest(hostClient, guestClient);

    expect(await ended).toMatchObject({ reason: "allFinished" });
  });
});

describe("race:giveUp", () => {
  test("Should_MakeRacerSpectator_When_RacerGivesUp", async () => {
    const { hostClient, guestClient } = await lobbyWithTwo();
    await startRace(hostClient);

    expect(await giveUp(guestClient)).toEqual({ ok: true });

    expect(await progress(guestClient, typing("U", 0))).toEqual({
      ok: false,
      error: "notRacer",
    });
  });

  test("Should_EndRace_When_EveryoneElseFinishes", async () => {
    const { hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    await giveUp(guestClient);
    const ended = next<RaceEndedMessage>(guestClient, "race:ended");

    await progress(hostClient, typing(content, 0));

    expect(await ended).toMatchObject({ reason: "allFinished" });
  });

  test("Should_EndRace_When_LastRacerStillTypingGivesUp", async () => {
    const { hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    await progress(hostClient, typing(content, 0));
    const ended = next<RaceEndedMessage>(hostClient, "race:ended");

    await giveUp(guestClient);

    expect(await ended).toMatchObject({ reason: "allFinished" });
  });

  test("Should_StaySpectator_When_RacerWhoGaveUpComesBack", async () => {
    const { guest, lobby, hostClient, guestClient } = await lobbyWithTwo();
    await startRace(hostClient);
    await giveUp(guestClient);
    await dropGuest(hostClient, guestClient);

    const { started } = await guestComesBack(lobby, guest);

    expect(started.mine?.gaveUp).toBe(true);
  });

  test("Should_AckCannotGiveUp_When_RacerHasFinished", async () => {
    const { hostClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    await progress(hostClient, typing(content, 0));

    expect(await giveUp(hostClient)).toEqual({ ok: false, error: "cannotGiveUp" });
  });

  test("Should_AckRaceNotRunning_When_RaceHasNotStarted", async () => {
    const { guestClient } = await lobbyWithTwo();

    expect(await giveUp(guestClient)).toEqual({ ok: false, error: "raceNotRunning" });
  });

  test("Should_AckNotRacer_When_SpectatorHostGivesUp", async () => {
    const { hostClient } = await lobbyWithThree();
    await startWatching(hostClient);

    expect(await giveUp(hostClient)).toEqual({ ok: false, error: "notRacer" });
  });
});

// Attend le classement qui remplit la condition (les positions partent par paquets).
function positionsWhere(
  client: Socket,
  check: (message: RacePositionsMessage) => boolean,
): Promise<RacePositionsMessage> {
  return new Promise((resolve) => {
    const listener = (message: RacePositionsMessage) => {
      if (!check(message)) return;
      client.off("race:positions", listener);
      resolve(message);
    };
    client.on("race:positions", listener);
  });
}

const summary = (message: RacePositionsMessage) =>
  message.positions.map(({ id, position }) => [id, position]);

describe("race:positions", () => {
  test("Should_SendEveryRacerAtZeroWithName_When_RaceStarts", async () => {
    const { host, guest, guestClient, hostClient } = await lobbyWithTwo();
    const guestSees = next<RacePositionsMessage>(guestClient, "race:positions");

    await startRace(hostClient);

    expect(await guestSees).toEqual({
      positions: [
        { id: host.id, username: host.username, position: 0, wpm: 0 },
        { id: guest.id, username: guest.username, position: 0, wpm: 0 },
      ],
    });
  });

  test("Should_RankFurthestRacerFirst_When_RacersType", async () => {
    const { host, guest, hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    const hostSees = positionsWhere(hostClient, (message) => message.positions[0].position > 0);

    await progress(guestClient, typing(content.slice(0, 3), 0));

    expect(summary(await hostSees)).toEqual([
      [guest.id, 3],
      [host.id, 0],
    ]);
  });

  test("Should_SendLiveWpm_When_RacerTypesCorrectCharacters", async () => {
    const { host, guest, hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    const hostSees = positionsWhere(hostClient, (message) => message.positions[0].position > 0);

    await progress(guestClient, typing(content.slice(0, 3), 0));

    const wpm = Object.fromEntries((await hostSees).positions.map((entry) => [entry.id, entry.wpm]));
    expect(Number.isInteger(wpm[guest.id]) && wpm[guest.id] > 0).toBe(true);
    expect(wpm[host.id]).toBe(0);
  });

  test("Should_RankFirstToArriveAhead_When_RacersAreTied", async () => {
    const { host, guest, hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    const hostSees = positionsWhere(hostClient, (message) =>
      message.positions.every(({ position }) => position === 2),
    );

    await progress(guestClient, typing(content.slice(0, 2), 0));
    await new Promise((resolve) => setTimeout(resolve, 10));
    await progress(hostClient, typing(content.slice(0, 2), 0));

    expect(summary(await hostSees)).toEqual([
      [guest.id, 2],
      [host.id, 2],
    ]);
  });

  test("Should_NotSendAgain_When_NobodyMoved", async () => {
    const { hostClient, guestClient } = await lobbyWithTwo();
    const first = next(guestClient, "race:positions");
    await startRace(hostClient);
    await first;
    let sent = 0;
    guestClient.on("race:positions", () => sent++);

    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(sent).toBe(0);
  });

  test("Should_SendCurrentPositions_When_RacerComesBackDuringRace", async () => {
    const { host, guest, lobby, hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    await progress(hostClient, typing(content.slice(0, 4), 0));
    await dropGuest(hostClient, guestClient);
    const back = await newClient(guest);
    const backSees = next<RacePositionsMessage>(back, "race:positions");

    await join(back, { code: lobby.code });

    expect(summary(await backSees)[0]).toEqual([host.id, 4]);
  });

  test("Should_SendFinalPositionsBeforeEnd_When_LastRacerFinishes", async () => {
    const { host, guest, hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    let last: RacePositionsMessage | undefined;
    hostClient.on("race:positions", (message: RacePositionsMessage) => (last = message));
    const ended = next(hostClient, "race:ended");

    await progress(guestClient, typing(content, 0));
    await new Promise((resolve) => setTimeout(resolve, 10));
    await progress(hostClient, typing(content, 0));
    await ended;

    expect(summary(last!)).toEqual([
      [guest.id, content.length],
      [host.id, content.length],
    ]);
  });
});

// Après une course, l'hôte relance le même lobby (LOB-9).
describe("lobby:restart", () => {
  async function finishedRace() {
    const setup = await lobbyWithTwo();
    const { content } = await startRace(setup.hostClient);
    const ended = next(setup.hostClient, "race:ended");
    await progress(setup.hostClient, typing(content, 0));
    await progress(setup.guestClient, typing(content, 0));
    await ended;
    return setup;
  }

  test("Should_SendEveryoneBackToWaitingAndKeepLobby_When_HostRelaunches", async () => {
    const { lobby, hostClient, guestClient } = await finishedRace();
    const hostNotified = next(hostClient, "lobby:restarted");
    const guestNotified = next(guestClient, "lobby:restarted");

    expect(await hostClient.emitWithAck("lobby:restart")).toEqual({ ok: true });

    await Promise.all([hostNotified, guestNotified]);
    expect((await findOpenLobby(lobby.code))?.id).toBe(lobby.id);
  });

  test("Should_StartNewRaceInSameLobby_When_HostStartsAfterRelaunch", async () => {
    const { lobby, hostClient } = await finishedRace();
    await hostClient.emitWithAck("lobby:restart");

    await startRace(hostClient);

    expect(await db.select().from(races).where(eq(races.lobbyId, lobby.id))).toHaveLength(2);
  });

  test("Should_UseNewSettings_When_HostChangedThemBeforeRelaunching", async () => {
    const { lobby, hostClient, guestClient } = await finishedRace();
    await hostClient.emitWithAck("lobby:restart");
    await updateLobbySettings(lobby.id, {
      textLanguage: "en",
      textLength: 50,
      errorMode: "tolerant",
      timeLimitSeconds: null,
      capacity: 30,
    });
    const guestSees = next<RaceStartedMessage>(guestClient, "race:started");

    await hostClient.emitWithAck("race:start", { watch: false });

    expect(await guestSees).toMatchObject({ errorMode: "tolerant", secondsLeft: null });
  });

  test("Should_SendNoOldResults_When_PlayerJoinsAfterRelaunch", async () => {
    const { lobby, hostClient } = await finishedRace();
    await hostClient.emitWithAck("lobby:restart");
    const late = await newClient();
    let sawResults = false;
    late.on("race:ended", () => (sawResults = true));

    await join(late, { code: lobby.code });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(sawResults).toBe(false);
  });

  test("Should_AckRaceNotFinished_When_NoRaceHasRun", async () => {
    const { hostClient } = await lobbyWithTwo();

    expect(await hostClient.emitWithAck("lobby:restart")).toEqual({
      ok: false,
      error: "raceNotFinished",
    });
  });

  test("Should_AckRaceNotFinished_When_RaceIsRunning", async () => {
    const { hostClient } = await lobbyWithTwo();
    await startRace(hostClient);

    expect(await hostClient.emitWithAck("lobby:restart")).toEqual({
      ok: false,
      error: "raceNotFinished",
    });
  });

  test("Should_AckNotHost_When_PlayerIsNotHost", async () => {
    const { guestClient } = await finishedRace();

    expect(await guestClient.emitWithAck("lobby:restart")).toEqual({
      ok: false,
      error: "notHost",
    });
  });

  test("Should_AckLobbyNotFound_When_SocketHasNotJoinedALobby", async () => {
    const client = await newClient();

    expect(await client.emitWithAck("lobby:restart")).toEqual({
      ok: false,
      error: "lobbyNotFound",
    });
  });
});

describe("lobby:close", () => {
  test("Should_AckRaceInProgressAndKeepLobbyOpen_When_RaceHasStarted", async () => {
    const { lobby, hostClient } = await lobbyWithTwo();
    const started = next(hostClient, "race:started");
    await hostClient.emitWithAck("race:start", { watch: false });

    expect(await hostClient.emitWithAck("lobby:close")).toEqual({
      ok: false,
      error: "raceInProgress",
    });
    await started;
    expect(await hostClient.emitWithAck("lobby:close")).toEqual({
      ok: false,
      error: "raceInProgress",
    });
    expect(await findOpenLobby(lobby.code)).not.toBeNull();
  });

  test("Should_CloseLobbyAndNotifyEveryone_When_HostCloses", async () => {
    const host = await newUser();
    const lobby = await createLobby(host.id, "public");
    const hostClient = await newClient(host);
    await join(hostClient, { code: lobby.code });
    const guestClient = await newClient();
    await join(guestClient, { code: lobby.code });
    const hostNotified = new Promise((resolve) => hostClient.once("lobby:closed", resolve));
    const guestNotified = new Promise((resolve) => guestClient.once("lobby:closed", resolve));

    expect(await hostClient.emitWithAck("lobby:close")).toEqual({ ok: true });

    await Promise.all([hostNotified, guestNotified]);
    expect(await findOpenLobby(lobby.code)).toBeNull();
  });

  test("Should_RefuseJoin_When_LobbyWasClosed", async () => {
    const host = await newUser();
    const lobby = await createLobby(host.id, "unlisted");
    const hostClient = await newClient(host);
    await join(hostClient, { code: lobby.code });
    await hostClient.emitWithAck("lobby:close");

    expect(await join(await newClient(), { code: lobby.code })).toEqual({
      ok: false,
      error: "lobbyNotFound",
    });
  });

  test("Should_AckErrorAndKeepLobbyOpen_When_PlayerIsNotHost", async () => {
    const lobby = await createLobby((await newUser()).id, "unlisted");
    const guestClient = await newClient();
    await join(guestClient, { code: lobby.code });

    expect(await guestClient.emitWithAck("lobby:close")).toEqual({
      ok: false,
      error: "notHost",
    });
    expect(await findOpenLobby(lobby.code)).not.toBeNull();
  });

  test("Should_AckError_When_SocketHasNotJoinedALobby", async () => {
    const client = await newClient();

    expect(await client.emitWithAck("lobby:close")).toEqual({
      ok: false,
      error: "lobbyNotFound",
    });
  });
});

// L'hôte exclut un participant ou un spectateur ; il ne peut plus revenir (SALLE-07).
describe("lobby:kick", () => {
  test("Should_RemoveAndNotifyKickedPlayer_When_HostKicks", async () => {
    const { host, guest, hostClient, guestClient } = await lobbyWithTwo();
    const kicked = next(guestClient, "lobby:kicked");
    const participants = nextParticipants(hostClient);

    expect(await hostClient.emitWithAck("lobby:kick", { id: guest.id })).toEqual({ ok: true });

    await kicked;
    expect((await participants).participants.map((p) => p.id)).toEqual([host.id]);
  });

  test("Should_RefuseRejoin_When_PlayerWasKicked", async () => {
    const { guest, lobby, hostClient } = await lobbyWithTwo();
    await hostClient.emitWithAck("lobby:kick", { id: guest.id });

    expect(await join(await newClient(guest), { code: lobby.code })).toEqual({
      ok: false,
      error: "lobbyNotFound",
    });
  });

  test("Should_RefuseRejoinWithInvite_When_InvitedPlayerWasKicked", async () => {
    const host = await newUser();
    const lobby = await createLobby(host.id, "private");
    const [token] = await createInvites(lobby.id, 1);
    const guest = await newUser();
    await claimInvite(token, guest.id, "203.0.113.1");
    const hostClient = await newClient(host);
    await join(hostClient, { code: lobby.code });
    await join(await newClient(guest), { code: lobby.code });

    await hostClient.emitWithAck("lobby:kick", { id: guest.id });

    expect(await claimInvite(token, guest.id, "203.0.113.1")).toBeNull();
    expect(await join(await newClient(guest), { code: lobby.code })).toEqual({
      ok: false,
      error: "lobbyNotFound",
    });
  });

  test("Should_AckNotHostAndKeepPlayer_When_PlayerIsNotHost", async () => {
    const { host, lobby, guestClient } = await lobbyWithTwo();

    expect(await guestClient.emitWithAck("lobby:kick", { id: host.id })).toEqual({
      ok: false,
      error: "notHost",
    });
    expect((await listParticipants(lobby.id)).map((p) => p.id)).toContain(host.id);
  });

  test("Should_AckError_When_HostKicksThemself", async () => {
    const { host, hostClient } = await lobbyWithTwo();

    expect(await hostClient.emitWithAck("lobby:kick", { id: host.id })).toEqual({
      ok: false,
      error: "cannotKickSelf",
    });
  });

  test("Should_AckError_When_TargetIsNotInLobby", async () => {
    const { hostClient } = await lobbyWithTwo();

    expect(
      await hostClient.emitWithAck("lobby:kick", { id: (await newUser()).id }),
    ).toEqual({ ok: false, error: "participantNotFound" });
  });

  test("Should_AckInvalidMessage_When_PayloadIsMalformed", async () => {
    const { hostClient } = await lobbyWithTwo();

    expect(await hostClient.emitWithAck("lobby:kick", { id: 42 })).toEqual({
      ok: false,
      error: "invalidMessage",
    });
  });

  test("Should_KickSpectator_When_HostWatchesRace", async () => {
    const { other, hostClient, otherClient } = await lobbyWithThree();
    await startWatching(hostClient);
    await giveUp(otherClient);
    const kicked = next(otherClient, "lobby:kicked");

    expect(await hostClient.emitWithAck("lobby:kick", { id: other.id })).toEqual({ ok: true });
    await kicked;
  });

  test("Should_EndRace_When_LastRacerStillTypingIsKicked", async () => {
    const { guest, hostClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    await progress(hostClient, typing(content, 0));
    const ended = next<RaceEndedMessage>(hostClient, "race:ended");

    await hostClient.emitWithAck("lobby:kick", { id: guest.id });

    const { reason, results } = await ended;
    expect(reason).toBe("allFinished");
    expect(results.find((result) => result.id === guest.id)?.finished).toBe(false);
  });
});

describe("disconnect", () => {
  test("Should_RemovePlayerAndNotifyOthers_When_PlayerDisconnects", async () => {
    const host = await newUser();
    const lobby = await createLobby(host.id, "unlisted");
    const hostClient = await newClient(host);
    await join(hostClient, { code: lobby.code });
    const guestClient = await newClient();
    await join(guestClient, { code: lobby.code });
    const hostSees = nextParticipants(hostClient);

    guestClient.disconnect();

    expect(await hostSees).toEqual({
      hostId: host.id,
      participants: [{ id: host.id, username: host.username }],
    });
  });

  test("Should_KeepPlayer_When_AnotherTabIsStillOpen", async () => {
    const host = await newUser();
    const guest = await newUser();
    const lobby = await createLobby(host.id, "unlisted");
    const firstTab = await newClient(guest);
    const secondTab = await newClient(guest);
    await join(firstTab, { code: lobby.code });
    await join(secondTab, { code: lobby.code });

    firstTab.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(await listParticipants(lobby.id)).toEqual([{ id: guest.id, username: guest.username }]);
  });
});

// SALLE-08 : l'hôte parti est remplacé par le plus ancien humain, sinon le lobby ferme.
describe("host transfer", () => {
  beforeEach(async () => {
    await io.close();
    await startServer({ hostGraceMs: 50 });
  });

  function hostChanged(client: Socket, hostId: string): Promise<ParticipantsMessage> {
    return new Promise((resolve) => {
      const listener = (message: ParticipantsMessage) => {
        if (message.hostId !== hostId) return;
        client.off("lobby:participants", listener);
        resolve(message);
      };
      client.on("lobby:participants", listener);
    });
  }

  // L'hôte et deux autres, arrivés dans l'ordre.
  async function lobbyWithThree() {
    const { host, guest: first, lobby, hostClient, guestClient: firstClient } = await lobbyWithTwo();
    const second = await newUser();
    const secondClient = await newClient(second);
    await join(secondClient, { code: lobby.code });
    return { host, first, second, lobby, hostClient, firstClient, secondClient };
  }

  test("Should_MakeOldestHumanHost_When_HostLeaves", async () => {
    const { first, second, lobby, hostClient, secondClient } = await lobbyWithThree();
    const secondSees = hostChanged(secondClient, first.id);

    hostClient.disconnect();

    expect(await secondSees).toEqual({
      hostId: first.id,
      participants: [
        { id: first.id, username: first.username },
        { id: second.id, username: second.username },
      ],
    });
    expect((await findOpenLobby(lobby.code))?.hostId).toBe(first.id);
  });

  test("Should_PassHostAgain_When_NewHostLeavesToo", async () => {
    const { first, second, hostClient, firstClient, secondClient } = await lobbyWithThree();
    const firstTransfer = hostChanged(secondClient, first.id);
    hostClient.disconnect();
    await firstTransfer;
    const secondSees = hostChanged(secondClient, second.id);

    firstClient.disconnect();

    expect((await secondSees).participants).toEqual([{ id: second.id, username: second.username }]);
  });

  test("Should_LetNewHostUseHostActions_When_HostWasTransferred", async () => {
    const { guest, hostClient, guestClient } = await lobbyWithTwo();
    const transferred = hostChanged(guestClient, guest.id);
    hostClient.disconnect();
    await transferred;

    expect(await guestClient.emitWithAck("lobby:addBot", { level: "expert" })).toEqual({ ok: true });
  });

  test("Should_TransferHost_When_HostLeavesDuringRace", async () => {
    const { guest, hostClient, guestClient } = await lobbyWithTwo();
    const started = next(guestClient, "race:started");
    await hostClient.emitWithAck("race:start", { watch: false });
    await started;
    const guestSees = hostChanged(guestClient, guest.id);

    hostClient.disconnect();

    expect((await guestSees).hostId).toBe(guest.id);
  });

  test("Should_SkipBots_When_PickingNewHost", async () => {
    const host = await newUser();
    const guest = await newUser();
    const lobby = await createLobby(host.id, "unlisted");
    const hostClient = await newClient(host);
    await join(hostClient, { code: lobby.code });
    await hostClient.emitWithAck("lobby:addBot", { level: "expert" });
    const guestClient = await newClient(guest);
    await join(guestClient, { code: lobby.code });
    const guestSees = hostChanged(guestClient, guest.id);

    hostClient.disconnect();

    expect((await guestSees).hostId).toBe(guest.id);
  });

  test("Should_CloseLobby_When_NoHumanIsLeft", async () => {
    const host = await newUser();
    const lobby = await createLobby(host.id, "unlisted");
    const hostClient = await newClient(host);
    await join(hostClient, { code: lobby.code });
    await hostClient.emitWithAck("lobby:addBot", { level: "expert" });

    hostClient.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(await findOpenLobby(lobby.code)).toBeNull();
  });

  test("Should_KeepHost_When_HostComesBackInTime", async () => {
    await io.close();
    await startServer({ hostGraceMs: 300 });
    const { host, lobby, hostClient } = await lobbyWithTwo();

    hostClient.disconnect();
    await join(await newClient(host), { code: lobby.code });
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect((await findOpenLobby(lobby.code))?.hostId).toBe(host.id);
  });

  test("Should_KeepHost_When_AnotherHostTabIsStillOpen", async () => {
    const { host, lobby, hostClient } = await lobbyWithTwo();
    await join(await newClient(host), { code: lobby.code });

    hostClient.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect((await findOpenLobby(lobby.code))?.hostId).toBe(host.id);
  });

  test("Should_TransferAtOnce_When_HostLeavesForAnotherLobby", async () => {
    await io.close();
    await startServer({ hostGraceMs: 60_000 });
    const { host, guest, guestClient } = await lobbyWithTwo();
    const other = await createLobby(guest.id, "unlisted");
    const guestSees = hostChanged(guestClient, guest.id);

    await join(await newClient(host), { code: other.code, leave: true });

    expect((await guestSees).hostId).toBe(guest.id);
  });
});

describe("sentence shots", () => {
  test.each([0, .9])("Should_ResolveOneShotAndPersistOnlyScoredRewards_When_RollIs_%s", async roll => {
    await io.close();
    const random = vi.fn(() => roll);
    await startServer({ shotMs: 30, shotRandom: random });
    const { host, hostClient, guestClient, lobby } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    const boundary = completedSentences(content, content)[0];
    expect(boundary).toBeDefined();
    expect(thirdWordAhead(content, boundary, [])).toBeDefined();
    const shot = next<RaceShotMessage>(guestClient, "race:shot");
    const rewards: RaceGoalMessage[] = [];
    const opponentRewards: RaceGoalMessage[] = [];
    hostClient.on("race:goal", message => rewards.push(message));
    guestClient.on("race:goal", message => opponentRewards.push(message));
    await progress(hostClient, typing(content.slice(0, boundary), 0));
    expect(await shot).toEqual({ id: host.id, sequence: boundary, scored: roll < .5 });
    // Continue during the shot: reward selection must use the latest cursor.
    const cursor = content.indexOf(" ", boundary + 2) + 2;
    await progress(hostClient, typing(content.slice(0, cursor), 0));
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(random).toHaveBeenCalledTimes(1);
    expect(opponentRewards).toEqual([]);
    if (roll < .5) {
      expect(rewards).toHaveLength(1);
      expect(rewards[0].removed).toEqual([thirdWordAhead(content, cursor, [])]);
    } else expect(rewards).toEqual([]);
    // Backspacing and retyping the sentence must not reroll the shot.
    await progress(hostClient, typing(content.slice(0, boundary - 1), 0));
    await progress(hostClient, typing(content.slice(0, boundary), 0));
    expect(random).toHaveBeenCalledTimes(1);
    const resumed = next<RaceStartedMessage>(hostClient, "race:started");
    await join(hostClient, { code: lobby.code });
    expect((await resumed).mine?.removed).toEqual(rewards[0]?.removed ?? []);
  });

  test("Should_NeverScore_When_GoalChanceIsZero", async () => {
    await io.close();
    await startServer({ shotRandom: () => 0, goalChance: 0 });
    const { hostClient, guestClient } = await lobbyWithTwo();
    const { content } = await startRace(hostClient);
    const shot = next<RaceShotMessage>(guestClient, "race:shot");

    await progress(hostClient, typing(content.slice(0, completedSentences(content, content)[0]), 0));

    expect((await shot).scored).toBe(false);
  });
});

describe("bots", () => {
  // L'hôte seul dans son lobby, sans autre joueur.
  async function hostAlone() {
    const host = await newUser();
    const lobby = await createLobby(host.id, "unlisted");
    const hostClient = await newClient(host);
    await join(hostClient, { code: lobby.code });
    return { host, lobby, hostClient };
  }

  function addBot(client: Socket, level: string): Promise<Ack> {
    return client.emitWithAck("lobby:addBot", { level });
  }

  test("Should_SendBotToEveryone_When_HostAddsBot", async () => {
    const { host, guestClient, hostClient } = await lobbyWithTwo();
    const guestSees = nextParticipants(guestClient);

    expect(await addBot(hostClient, "expert")).toEqual({ ok: true });

    const { participants } = await guestSees;
    expect(participants).toHaveLength(3);
    expect(participants[0].id).toBe(host.id);
    expect(participants[2]).toMatchObject({ bot: { level: "expert", number: 1 } });
  });

  test("Should_NumberBotsPerLevel_When_HostAddsSeveral", async () => {
    const { hostClient } = await hostAlone();
    await addBot(hostClient, "expert");
    await addBot(hostClient, "beginner");
    const hostSees = nextParticipants(hostClient);

    await addBot(hostClient, "expert");

    expect((await hostSees).participants.map((participant) => participant.bot)).toEqual([
      undefined,
      { level: "expert", number: 1 },
      { level: "beginner", number: 1 },
      { level: "expert", number: 2 },
    ]);
  });

  test("Should_SendBotsToPlayer_When_PlayerJoinsLater", async () => {
    const { lobby, hostClient } = await hostAlone();
    await addBot(hostClient, "advanced");
    const late = await newClient();
    const lateSees = nextParticipants(late);

    await join(late, { code: lobby.code });

    // Les joueurs d'abord, puis les bots.
    expect((await lateSees).participants[2]).toMatchObject({ bot: { level: "advanced" } });
  });

  test("Should_RemoveBot_When_HostRemovesIt", async () => {
    const { hostClient } = await hostAlone();
    const added = nextParticipants(hostClient);
    await addBot(hostClient, "beginner");
    const bot = (await added).participants[1];
    const hostSees = nextParticipants(hostClient);

    expect(await hostClient.emitWithAck("lobby:removeBot", { id: bot.id })).toEqual({ ok: true });

    expect((await hostSees).participants).toHaveLength(1);
  });

  test("Should_AckBotNotFound_When_HostRemovesUnknownBot", async () => {
    const { hostClient } = await hostAlone();

    expect(await hostClient.emitWithAck("lobby:removeBot", { id: "inconnu" })).toEqual({
      ok: false,
      error: "botNotFound",
    });
  });

  test("Should_AckNotHost_When_PlayerAddsBot", async () => {
    const { guestClient } = await lobbyWithTwo();

    expect(await addBot(guestClient, "expert")).toEqual({ ok: false, error: "notHost" });
  });

  test.each([undefined, {}, { level: "legend" }])(
    "Should_AckInvalidMessage_When_PayloadIs_%j",
    async (payload) => {
      const { hostClient } = await hostAlone();

      expect(await hostClient.emitWithAck("lobby:addBot", payload)).toEqual({
        ok: false,
        error: "invalidMessage",
      });
    },
  );

  test("Should_AckRaceInProgress_When_HostAddsBotDuringRace", async () => {
    const { hostClient } = await lobbyWithTwo();
    await startRace(hostClient);

    expect(await addBot(hostClient, "expert")).toEqual({ ok: false, error: "raceInProgress" });
  });

  test("Should_AckLobbyFull_When_BotWouldExceedCapacity", async () => {
    const { lobby, hostClient } = await hostAlone();
    await fillLobby(lobby.id, 28);

    expect(await addBot(hostClient, "expert")).toEqual({ ok: true });
    expect(await addBot(hostClient, "expert")).toEqual({ ok: false, error: "lobbyFull" });
  });

  test("Should_AckLobbyFull_When_HostLoweredCapacityBeforeAddingBot", async () => {
    const { lobby, hostClient } = await lobbyWithTwo();
    await updateLobbySettings(lobby.id, {
      textLanguage: "fr",
      textLength: 100,
      errorMode: "blocking",
      timeLimitSeconds: 300,
      capacity: 2,
    });

    expect(await addBot(hostClient, "expert")).toEqual({ ok: false, error: "lobbyFull" });
  });

  test("Should_RefusePlayer_When_BotsFillTheCapacity", async () => {
    const { lobby, hostClient } = await hostAlone();
    await updateLobbySettings(lobby.id, {
      textLanguage: "fr",
      textLength: 100,
      errorMode: "blocking",
      timeLimitSeconds: 300,
      capacity: 2,
    });
    await addBot(hostClient, "expert");

    expect(await join(await newClient(), { code: lobby.code })).toEqual({
      ok: false,
      error: "lobbyFull",
    });
  });

  test("Should_CountBotTowardMinimum_When_HostIsAloneWithABot", async () => {
    const { hostClient } = await hostAlone();
    await addBot(hostClient, "beginner");

    expect((await startRace(hostClient)).racerIds).toHaveLength(2);
  });

  test("Should_RankBotWithoutSavingIt_When_RaceEnds", async () => {
    const { host, lobby, hostClient } = await hostAlone();
    await db.update(users).set({ rankLevel: 10 }).where(eq(users.id, host.id));
    await addBot(hostClient, "beginner");
    const { content } = await startRace(hostClient);
    const ended = next<RaceEndedMessage>(hostClient, "race:ended");

    await progress(hostClient, typing(content, 0));

    const { reason, results: ranked } = await ended;
    expect(reason).toBe("allFinished");
    expect(ranked.map((result) => [result.rank, result.bot, result.finished])).toEqual([
      [1, undefined, true],
      [2, { level: "beginner", number: 1 }, true],
    ]);
    expect(ranked[0]).toMatchObject({ id: host.id, rankLevel: 11, rankChange: 1 });
    // Contre un bot débutant : 100 XP × (0,5 + 1) ÷ 2 ; le bot ne gagne rien.
    expect(ranked.map((result) => result.xpGained)).toEqual([75, 0]);
    const saved = await db
      .select()
      .from(results)
      .where(eq(results.raceId, (await savedRace(lobby.id)).id));
    expect(saved.map((row) => row.userId)).toEqual([host.id]);
  });

  test("Should_AckNoHumanRacer_When_HostWatchesWithOnlyBots", async () => {
    const { lobby, hostClient } = await hostAlone();
    await addBot(hostClient, "beginner");
    await addBot(hostClient, "expert");

    expect(await hostClient.emitWithAck("race:start", { watch: true })).toEqual({
      ok: false,
      error: "noHumanRacer",
    });
    expect(await db.select().from(races).where(eq(races.lobbyId, lobby.id))).toHaveLength(0);
  });

  test("Should_StartWithHostWatching_When_OneHumanAndOneBotRace", async () => {
    const { guest, hostClient } = await lobbyWithTwo();
    await addBot(hostClient, "beginner");
    const started = next<RaceStartedMessage>(hostClient, "race:started");

    expect(await hostClient.emitWithAck("race:start", { watch: true })).toEqual({ ok: true });

    expect((await started).racerIds).toEqual([guest.id, expect.any(String)]);
  });

  test("Should_MoveBotsForward_When_RaceRuns", async () => {
    const { hostClient } = await hostAlone();
    await addBot(hostClient, "beginner");
    await startRace(hostClient);
    await next(hostClient, "race:positions");

    // Après le départ à 0, le bot tape sans que l'hôte bouge.
    const { positions } = await next<RacePositionsMessage>(hostClient, "race:positions");

    expect(positions[0]).toMatchObject({ bot: { level: "beginner" } });
    expect(positions[0].position).toBeGreaterThan(0);
  });

  test("Should_KeepBots_When_HostRelaunches", async () => {
    const { hostClient } = await hostAlone();
    await addBot(hostClient, "expert");
    const ended = next(hostClient, "race:ended");
    await hostClient.emitWithAck("race:start", { watch: false });
    const started = await next<RaceStartedMessage>(hostClient, "race:started");
    await progress(hostClient, typing(started.content, 0));
    await ended;

    await hostClient.emitWithAck("lobby:restart");

    expect((await startRace(hostClient)).racerIds).toHaveLength(2);
  });
});

test("Should_BroadcastBoostOnlyForNewCorrectInput", async () => {
  const { host, hostClient, guestClient } = await lobbyWithTwo({ errorMode: "tolerant" });
  const { content } = await startRace(hostClient);
  const boosts: { id: string }[] = [];
  guestClient.on("race:boost", value => boosts.push(value));
  const boost = next<{ id: string }>(guestClient, "race:boost");
  await progress(hostClient, typing(content.slice(0, 1), 0));
  expect(await boost).toEqual({ id: host.id });
  await progress(hostClient, typing("", 0));
  const wrong = content[0] === "x" ? "z" : "x";
  await progress(hostClient, typing(wrong, 1));
  await progress(hostClient, typing(wrong, 1));
  await new Promise(resolve => setTimeout(resolve, 30));
  expect(boosts).toEqual([{ id: host.id }]);
});

// Attend la liste de l'explorateur où ce lobby est comme attendu (absent = undefined).
function listedWhere(
  client: Socket,
  code: string,
  check: (lobby: ExplorerLobby | undefined) => boolean,
): Promise<ExplorerLobby | undefined> {
  return new Promise((resolve) => {
    const handler = (message: LobbiesMessage) => {
      const lobby = message.lobbies.find((listed) => listed.code === code);
      if (!check(lobby)) return;
      client.off("lobbies:list", handler);
      resolve(lobby);
    };
    client.on("lobbies:list", handler);
  });
}

// Un hôte seul dans un lobby public, et quelqu'un qui regarde l'explorateur.
async function watchedLobby() {
  const host = await newUser();
  const lobby = await createLobby(host.id, "public", { capacity: 4, textLanguage: "en" });
  const hostClient = await newClient(host);
  await join(hostClient, { code: lobby.code });
  const watcher = await newClient();
  const first = listedWhere(watcher, lobby.code, (listed) => listed !== undefined);
  watcher.emit("lobbies:watch");
  return { host, lobby, hostClient, watcher, first: await first };
}

describe("lobbies explorer", () => {
  test("Should_SendLobbyInfo_When_Watching", async () => {
    const { host, lobby, first } = await watchedLobby();

    expect(first).toEqual({
      code: lobby.code,
      hostName: host.username,
      participantCount: 1,
      capacity: 4,
      textLanguage: "en",
      state: "waiting",
    });
  });

  test("Should_NotListLobby_When_LobbyIsUnlisted", async () => {
    const host = await newUser();
    const lobby = await createLobby(host.id, "unlisted");
    const hostClient = await newClient(host);
    await join(hostClient, { code: lobby.code });
    const watcher = await newClient();
    const list = next<LobbiesMessage>(watcher, "lobbies:list");
    watcher.emit("lobbies:watch");

    expect((await list).lobbies.map((listed) => listed.code)).not.toContain(lobby.code);
  });

  test("Should_PushNewCount_When_SomeoneJoinsOrLeaves", async () => {
    const { lobby, watcher } = await watchedLobby();
    const guestClient = await newClient();

    const joined = listedWhere(watcher, lobby.code, (listed) => listed?.participantCount === 2);
    await join(guestClient, { code: lobby.code });
    await joined;
    const left = listedWhere(watcher, lobby.code, (listed) => listed?.participantCount === 1);
    guestClient.disconnect();

    expect(await left).toMatchObject({ participantCount: 1 });
  });

  test("Should_CountBot_When_HostAddsBot", async () => {
    const { lobby, hostClient, watcher } = await watchedLobby();

    const updated = listedWhere(watcher, lobby.code, (listed) => listed?.participantCount === 2);
    await hostClient.emitWithAck("lobby:addBot", { level: "expert" });

    expect(await updated).toMatchObject({ participantCount: 2 });
  });

  test("Should_PushState_When_RaceStartsEndsAndRestarts", async () => {
    const { lobby, hostClient, watcher } = await watchedLobby();
    const guestClient = await newClient();
    await join(guestClient, { code: lobby.code });

    const racing = listedWhere(watcher, lobby.code, (listed) => listed?.state === "racing");
    await startRace(hostClient);
    await racing;
    const finished = listedWhere(watcher, lobby.code, (listed) => listed?.state === "finished");
    await giveUp(hostClient);
    await giveUp(guestClient);
    await finished;
    const waiting = listedWhere(watcher, lobby.code, (listed) => listed?.state === "waiting");
    await hostClient.emitWithAck("lobby:restart");

    expect(await waiting).toMatchObject({ state: "waiting" });
  });

  test("Should_RemoveLobby_When_HostCloses", async () => {
    const { lobby, hostClient, watcher } = await watchedLobby();

    const removed = listedWhere(watcher, lobby.code, (listed) => listed === undefined);
    await hostClient.emitWithAck("lobby:close");

    expect(await removed).toBeUndefined();
  });
});
