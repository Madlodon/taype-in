// @vitest-environment node
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Server } from "socket.io";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";
import { lobbies, users } from "../db/schema";
import { createSession } from "../lib/auth";
import { createLobby, listParticipants } from "../lib/lobbies";
import { createSocketServer } from "../lib/socket-server";
import type { Ack, ParticipantsMessage } from "../lib/socket-messages";

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
  io = createSocketServer(httpServer);
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
