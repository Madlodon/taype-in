// @vitest-environment node
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Server } from "socket.io";
import { io as connect, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createSocketServer } from "../lib/socket-server";
import type { Ack } from "../lib/socket-messages";

let io: Server;
let url: string;
const clients: Socket[] = [];

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
});

async function newClient(): Promise<Socket> {
  const client = connect(url, { transports: ["websocket"] });
  clients.push(client);
  await new Promise<void>((resolve) => client.on("connect", resolve));
  return client;
}

function join(client: Socket, payload: unknown): Promise<Ack> {
  return client.emitWithAck("lobby:join", payload);
}

describe("lobby:join", () => {
  test("Should_AckOk_When_CodeIsValid", async () => {
    const client = await newClient();

    expect(await join(client, { code: "ABC123" })).toEqual({ ok: true });
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

    expect(await join(client, payload)).toEqual({ ok: false, error: "Message invalide" });
  });

  test("Should_NotifyOthers_When_PlayerJoinsSameLobby", async () => {
    const first = await newClient();
    const second = await newClient();
    await join(first, { code: "ABC123" });
    const notified = new Promise((resolve) => first.on("lobby:playerJoined", resolve));

    await join(second, { code: "ABC123" });

    expect(await notified).toEqual({ id: second.id });
  });

  test("Should_NotNotify_When_PlayerJoinsOtherLobby", async () => {
    const first = await newClient();
    const second = await newClient();
    await join(first, { code: "ABC123" });
    let notified = false;
    first.on("lobby:playerJoined", () => (notified = true));

    await join(second, { code: "XYZ789" });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(notified).toBe(false);
  });
});
