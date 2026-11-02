// @vitest-environment node
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Server } from "socket.io";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";
import { lobbies, users } from "../db/schema";
import { createSession, validateSessionToken } from "../lib/auth";
import { createLobby, findOpenLobby } from "../lib/lobbies";
import { markRaceStarted } from "../lib/races";
import { createSocketServer } from "../lib/socket-server";
import type { Ack } from "../lib/socket-messages";

// Les vraies fonctions, qu'un test fait échouer une fois comme une base de données en panne.
vi.mock("../lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/auth")>();
  return { ...actual, validateSessionToken: vi.fn(actual.validateSessionToken) };
});
vi.mock("../lib/lobbies", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/lobbies")>();
  return { ...actual, findOpenLobby: vi.fn(actual.findOpenLobby) };
});
vi.mock("../lib/races", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/races")>();
  return { ...actual, markRaceStarted: vi.fn(actual.markRaceStarted) };
});

let io: Server;
let url: string;
const clients: Socket[] = [];
const createdIds: string[] = [];
const dbDown = new Error("base de données en panne");

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "db/migrations" });
});

beforeEach(async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const httpServer = createServer();
  io = createSocketServer(httpServer, { countdownMs: 50 });
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  vi.restoreAllMocks();
  clients.forEach((client) => client.disconnect());
  clients.length = 0;
  await io.close();
  const ids = createdIds.splice(0);
  if (ids.length === 0) return;
  await db.delete(lobbies).where(inArray(lobbies.hostId, ids));
  await db.delete(users).where(inArray(users.id, ids));
});

afterAll(async () => {
  // Les gestionnaires « disconnect » font encore des requêtes après io.close().
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

function open(cookie: string): Socket {
  const client = connect(url, { transports: ["websocket"], extraHeaders: { cookie } });
  clients.push(client);
  return client;
}

async function newClient(user: { id: string }): Promise<Socket> {
  const { token } = await createSession(user.id);
  const client = open(`session=${token}`);
  await new Promise<void>((resolve) => client.on("connect", resolve));
  return client;
}

function join(client: Socket, code: string): Promise<Ack> {
  return client.emitWithAck("lobby:join", { code });
}

test("Should_AckServerErrorAndKeepAnswering_When_HandlerThrows", async () => {
  const host = await newUser();
  const lobby = await createLobby(host.id, "unlisted");
  const client = await newClient(host);
  vi.mocked(findOpenLobby).mockRejectedValueOnce(dbDown);

  expect(await join(client, lobby.code)).toEqual({ ok: false, error: "serverError" });
  expect(console.error).toHaveBeenCalledWith(expect.stringContaining("lobby:join"), dbDown);
  expect(await join(client, lobby.code)).toEqual({ ok: true });
});

test("Should_LogAndKeepRunning_When_TimerTaskThrows", async () => {
  const host = await newUser();
  const lobby = await createLobby(host.id, "unlisted");
  const hostClient = await newClient(host);
  const racer = await newClient(await newUser());
  await join(hostClient, lobby.code);
  await join(racer, lobby.code);
  vi.mocked(markRaceStarted).mockRejectedValueOnce(dbDown);

  expect(await hostClient.emitWithAck("race:start", { watch: false })).toEqual({ ok: true });

  await vi.waitFor(() =>
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("countdownEnd"), dbDown),
  );
  const other = await newUser();
  const otherLobby = await createLobby(other.id, "unlisted");
  expect(await join(await newClient(other), otherLobby.code)).toEqual({ ok: true });
});

test("Should_RefuseConnectionWithServerError_When_SessionCheckThrows", async () => {
  const { token } = await createSession((await newUser()).id);
  vi.mocked(validateSessionToken).mockRejectedValueOnce(dbDown);

  const client = open(`session=${token}`);
  const error = await new Promise<Error>((resolve) => client.on("connect_error", resolve));

  expect(error.message).toBe("serverError");
  expect(console.error).toHaveBeenCalledWith(expect.stringContaining("connexion"), dbDown);
});
