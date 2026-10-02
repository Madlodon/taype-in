// @vitest-environment node
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Server } from "socket.io";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";
import { lobbies, lobbyParticipants, races, users } from "../db/schema";
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

beforeEach(async () => {
  const httpServer = createServer();
  // Compte à rebours raccourci pour garder les tests rapides.
  io = createSocketServer(httpServer, { countdownMs: 100 });
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
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
async function lobbyWithTwo() {
  const host = await newUser();
  const guest = await newUser();
  const lobby = await createLobby(host.id, "unlisted");
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

    expect(await hostClient.emitWithAck("race:start")).toEqual({ ok: true });

    expect(await hostSees).toEqual({ seconds: 1 });
    expect(await guestSees).toEqual({ seconds: 1 });
    await started;
  });

  test("Should_SendSameTextToEveryone_When_CountdownEnds", async () => {
    const { host, guest, hostClient, guestClient } = await lobbyWithTwo();
    const hostSees = next<RaceStartedMessage>(hostClient, "race:started");
    const guestSees = next<RaceStartedMessage>(guestClient, "race:started");

    await hostClient.emitWithAck("race:start");

    const message = await hostSees;
    expect(message.content).not.toBe("");
    expect(message.racerIds).toEqual([host.id, guest.id]);
    expect(await guestSees).toEqual(message);
  });

  test("Should_SaveRaceWithTextAndStartTime_When_CountdownEnds", async () => {
    const { lobby, hostClient } = await lobbyWithTwo();
    const started = next<RaceStartedMessage>(hostClient, "race:started");

    await hostClient.emitWithAck("race:start");
    const { content } = await started;

    const [race] = await db.select().from(races).where(eq(races.lobbyId, lobby.id));
    expect(race.content).toBe(content);
    expect(race.startedAt).not.toBeNull();
  });

  test("Should_AckNotHost_When_PlayerIsNotHost", async () => {
    const { guestClient } = await lobbyWithTwo();

    expect(await guestClient.emitWithAck("race:start")).toEqual({
      ok: false,
      error: "notHost",
    });
  });

  test("Should_AckNotEnoughParticipants_When_HostIsAlone", async () => {
    const host = await newUser();
    const lobby = await createLobby(host.id, "unlisted");
    const hostClient = await newClient(host);
    await join(hostClient, { code: lobby.code });

    expect(await hostClient.emitWithAck("race:start")).toEqual({
      ok: false,
      error: "notEnoughParticipants",
    });
  });

  test("Should_AckLobbyNotFound_When_SocketHasNotJoinedALobby", async () => {
    const client = await newClient();

    expect(await client.emitWithAck("race:start")).toEqual({
      ok: false,
      error: "lobbyNotFound",
    });
  });

  test("Should_AckRaceInProgress_When_RaceAlreadyStarted", async () => {
    const { hostClient } = await lobbyWithTwo();
    const started = next(hostClient, "race:started");
    await hostClient.emitWithAck("race:start");

    expect(await hostClient.emitWithAck("race:start")).toEqual({
      ok: false,
      error: "raceInProgress",
    });
    await started;
  });

  test("Should_StartOnce_When_HostStartsTwiceAtTheSameTime", async () => {
    const { lobby, hostClient } = await lobbyWithTwo();
    const started = next(hostClient, "race:started");

    const acks = await Promise.all([
      hostClient.emitWithAck("race:start"),
      hostClient.emitWithAck("race:start"),
    ]);
    await started;

    expect(acks).toContainEqual({ ok: true });
    expect(acks).toContainEqual({ ok: false, error: "raceInProgress" });
    expect(await db.select().from(races).where(eq(races.lobbyId, lobby.id))).toHaveLength(1);
  });

  test("Should_SendCountdown_When_PlayerJoinsDuringCountdown", async () => {
    const { lobby, hostClient } = await lobbyWithTwo();
    const started = next(hostClient, "race:started");
    await hostClient.emitWithAck("race:start");
    const late = await newClient();
    const lateSees = next<CountdownMessage>(late, "race:countdown");

    await join(late, { code: lobby.code });

    expect(await lateSees).toEqual({ seconds: 1 });
    await started;
  });

  test("Should_SendTextWithoutRacingHim_When_PlayerJoinsDuringRace", async () => {
    const { host, guest, lobby, hostClient } = await lobbyWithTwo();
    const started = next<RaceStartedMessage>(hostClient, "race:started");
    await hostClient.emitWithAck("race:start");
    const { content } = await started;
    const late = await newClient();
    const lateSees = next<RaceStartedMessage>(late, "race:started");

    await join(late, { code: lobby.code });

    expect(await lateSees).toEqual({ content, racerIds: [host.id, guest.id] });
  });
});

describe("lobby:close", () => {
  test("Should_AckRaceInProgressAndKeepLobbyOpen_When_RaceHasStarted", async () => {
    const { lobby, hostClient } = await lobbyWithTwo();
    const started = next(hostClient, "race:started");
    await hostClient.emitWithAck("race:start");

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

    expect(await listParticipants(lobby.id)).toEqual([
      { id: guest.id, username: guest.username },
    ]);
  });
});
