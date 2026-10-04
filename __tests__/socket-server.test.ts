// @vitest-environment node
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Server } from "socket.io";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { eq, inArray } from "drizzle-orm";
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
  MAX_PARTICIPANTS,
} from "../lib/lobbies";
import { createSocketServer } from "../lib/socket-server";
import type {
  Ack,
  CountdownMessage,
  ParticipantsMessage,
  RaceEndedMessage,
  RacePositionsMessage,
  RaceStartedMessage,
} from "../lib/socket-messages";

let io: Server;
let url: string;
const clients: Socket[] = [];
// Utilisateurs créés par un test, supprimés après (avec leurs lobbys).
const createdIds: string[] = [];

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "db/migrations" });
});

// Compte à rebours raccourci pour garder les tests rapides.
async function startServer(options: { idleMs?: number } = {}) {
  const httpServer = createServer();
  io = createSocketServer(httpServer, { countdownMs: 100, ...options });
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

  test("Should_AckOk_When_UserUsedAnInviteToPrivateLobby", async () => {
    const lobby = await createLobby((await newUser()).id, "private");
    const [token] = await createInvites(lobby.id, 1);
    const student = await newUser();
    await claimInvite(token, student.id);
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

  test("Should_AckLobbyFull_When_LobbyHasMaxParticipants", async () => {
    const lobby = await createLobby((await newUser()).id, "unlisted");
    await fillLobby(lobby.id, MAX_PARTICIPANTS);

    expect(await join(await newClient(), { code: lobby.code })).toEqual({
      ok: false,
      error: "lobbyFull",
    });
  });

  test("Should_AckOk_When_LobbyIsFullButPlayerIsAlreadyIn", async () => {
    const lobby = await createLobby((await newUser()).id, "unlisted");
    const [first] = await fillLobby(lobby.id, MAX_PARTICIPANTS);

    expect(await join(await newClient(first), { code: lobby.code })).toEqual({ ok: true });
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

  test("Should_SendCountdown_When_PlayerJoinsDuringCountdown", async () => {
    const { lobby, hostClient } = await lobbyWithTwo();
    const started = next(hostClient, "race:started");
    await hostClient.emitWithAck("race:start", { watch: false });
    const late = await newClient();
    const lateSees = next<CountdownMessage>(late, "race:countdown");

    await join(late, { code: lobby.code });

    expect(await lateSees).toEqual({ seconds: 1 });
    await started;
  });

  test("Should_SendTextWithoutRacingHim_When_PlayerJoinsDuringRace", async () => {
    const { host, guest, lobby, hostClient } = await lobbyWithTwo();
    const started = next<RaceStartedMessage>(hostClient, "race:started");
    await hostClient.emitWithAck("race:start", { watch: false });
    const { content } = await started;
    const late = await newClient();
    const lateSees = next<RaceStartedMessage>(late, "race:started");

    await join(late, { code: lobby.code });

    expect(await lateSees).toMatchObject({
      content,
      errorMode: "blocking",
      racerIds: [host.id, guest.id],
    });
  });
});

// L'hôte regarde la course sans courir (LOB-8).
describe("race:start as spectator host", () => {
  // Un hôte et deux invités : assez de coureurs sans l'hôte.
  async function lobbyWithThree() {
    const { host, guest, lobby, hostClient, guestClient } = await lobbyWithTwo();
    const other = await newUser();
    const otherClient = await newClient(other);
    await join(otherClient, { code: lobby.code });
    return { host, guest, other, lobby, hostClient, guestClient, otherClient };
  }

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
    await startRace(hostClient);
    let ended = false;
    hostClient.on("race:ended", () => (ended = true));
    const endedLater = next<RaceEndedMessage>(hostClient, "race:ended");

    await new Promise((resolve) => setTimeout(resolve, 200));
    await progress(guestClient, typing("U", 0));
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

    await join(late, { code: lobby.code });

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

  test("Should_AckNotRacer_When_PlayerJoinedDuringRace", async () => {
    const { lobby, hostClient } = await lobbyWithTwo();
    await startRace(hostClient);
    const late = await newClient();
    await join(late, { code: lobby.code });

    expect(await progress(late, typing("U", 0))).toEqual({ ok: false, error: "notRacer" });
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

    expect(started.mine).toEqual({ ...typing(content.slice(0, 5), 2), gaveUp: false });
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

  test("Should_NotSendOwnProgress_When_PlayerWasNotRacing", async () => {
    const { lobby, hostClient } = await lobbyWithTwo();
    await startRace(hostClient);
    const late = await newClient();
    const lateSees = next<RaceStartedMessage>(late, "race:started");

    await join(late, { code: lobby.code });

    expect((await lateSees).mine).toBeUndefined();
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

  test("Should_AckNotRacer_When_PlayerJoinedDuringRace", async () => {
    const { lobby, hostClient } = await lobbyWithTwo();
    await startRace(hostClient);
    const late = await newClient();
    await join(late, { code: lobby.code });

    expect(await giveUp(late)).toEqual({ ok: false, error: "notRacer" });
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
        { id: host.id, username: host.username, position: 0 },
        { id: guest.id, username: guest.username, position: 0 },
      ],
    });
  });

  test("Should_RankFurthestRacerFirst_When_RacersType", async () => {
    const { host, guest, hostClient, guestClient } = await lobbyWithTwo();
    await startRace(hostClient);
    const hostSees = positionsWhere(hostClient, (message) => message.positions[0].position > 0);

    await progress(guestClient, typing("abc", 0));

    expect(summary(await hostSees)).toEqual([
      [guest.id, 3],
      [host.id, 0],
    ]);
  });

  test("Should_RankFirstToArriveAhead_When_RacersAreTied", async () => {
    const { host, guest, hostClient, guestClient } = await lobbyWithTwo();
    await startRace(hostClient);
    const hostSees = positionsWhere(hostClient, (message) =>
      message.positions.every(({ position }) => position === 2),
    );

    await progress(guestClient, typing("ab", 0));
    await new Promise((resolve) => setTimeout(resolve, 10));
    await progress(hostClient, typing("ab", 0));

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

  test("Should_SendCurrentPositions_When_PlayerJoinsDuringRace", async () => {
    const { host, lobby, hostClient } = await lobbyWithTwo();
    await startRace(hostClient);
    await progress(hostClient, typing("abcd", 0));
    const late = await newClient();
    const lateSees = next<RacePositionsMessage>(late, "race:positions");

    await join(late, { code: lobby.code });

    expect(summary(await lateSees)[0]).toEqual([host.id, 4]);
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
