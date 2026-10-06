// Test de charge (LOB-6) : 300 participants dans une même course, via Socket.IO.
// Lance son propre serveur Socket.IO avec la base locale, crée des utilisateurs temporaires,
// fait taper tout le monde, mesure le délai des positions, puis supprime tout.
// Usage : bun run test:load [participants]
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { inArray } from "drizzle-orm";
import { io as connect, type Socket } from "socket.io-client";
import { db } from "../db/index.ts";
import { lobbies, users } from "../db/schema.ts";
import { createSession } from "../lib/auth.ts";
import { createLobby, MAX_PARTICIPANTS } from "../lib/lobbies.ts";
import { createSocketServer } from "../lib/socket-server.ts";
import type { RacePositionsMessage, RaceStartedMessage } from "../lib/socket-messages.ts";

// Délai jugé raisonnable entre une frappe et son affichage chez les autres (tick de 250 ms + marge).
export const MAX_P95_MS = 500;

export type LoadTestStats = {
  participants: number;
  // Messages race:positions reçus, tous clients confondus.
  updates: number;
  // Une mesure par frappe vue par un client : de l'envoi de la frappe à la réception des positions.
  samples: number;
  p50: number;
  p95: number;
  max: number;
};

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))] ?? 0;
}

export async function runLoadTest({
  participants = MAX_PARTICIPANTS,
  // Durée de frappe ; une frappe toutes les 200 ms ≈ 60 mots par minute.
  typingMs = 10_000,
  keystrokeMs = 200,
} = {}): Promise<LoadTestStats> {
  const httpServer = createServer();
  const io = createSocketServer(httpServer, { countdownMs: 1000 });
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;

  const rows = await db
    .insert(users)
    .values(
      Array.from({ length: participants }, (_, i) => ({
        username: `load_${i}_${Math.random().toString(36).slice(2, 8)}`,
      })),
    )
    .returning({ id: users.id });
  const ids = rows.map((row) => row.id);
  const clients: Socket[] = [];

  try {
    const lobby = await createLobby(ids[0], "unlisted");
    const tokens = await Promise.all(ids.map((id) => createSession(id)));

    // Moment d'envoi de chaque frappe : sentAt[coureur][position].
    const sentAt = new Map<string, number[]>(ids.map((id) => [id, []]));
    const latencies: number[] = [];
    let updates = 0;

    for (const { token } of tokens) {
      clients.push(
        connect(url, { transports: ["websocket"], extraHeaders: { cookie: `session=${token}` } }),
      );
    }
    await Promise.all(
      clients.map(async (client) => {
        if (!client.connected) await new Promise<void>((resolve) => client.once("connect", resolve));
        const ack = await client.emitWithAck("lobby:join", { code: lobby.code });
        if (!ack.ok) throw new Error(`lobby:join refusé : ${ack.error}`);
      }),
    );

    const started = clients.map(
      (client) =>
        new Promise<RaceStartedMessage>((resolve) => client.once("race:started", resolve)),
    );
    const ended = clients.map(
      (client) => new Promise<void>((resolve) => client.once("race:ended", () => resolve())),
    );

    // Chaque client note le délai de chaque nouvelle frappe qu'il voit passer.
    clients.forEach((client) => {
      const seen = new Map<string, number>();
      client.on("race:positions", ({ positions }: RacePositionsMessage) => {
        const now = Date.now();
        updates++;
        for (const { id, position } of positions) {
          for (let p = (seen.get(id) ?? 0) + 1; p <= position; p++) {
            latencies.push(now - sentAt.get(id)![p]);
          }
          seen.set(id, position);
        }
      });
    });

    const ack = await clients[0].emitWithAck("race:start", { watch: false });
    if (!ack.ok) throw new Error(`race:start refusé : ${ack.error}`);

    // Chaque coureur tape à son rythme, décalé au hasard pour ne pas tous envoyer en même temps.
    await Promise.all(
      clients.map(async (client, i) => {
        const { content } = await started[i];
        const typing = Math.min(content.length - 1, Math.floor(typingMs / keystrokeMs));
        await new Promise((resolve) => setTimeout(resolve, Math.random() * keystrokeMs));
        for (let position = 1; position <= typing; position++) {
          sentAt.get(ids[i])![position] = Date.now();
          client.emit("race:progress", {
            typed: content.slice(0, position),
            errors: 0,
            keys: position,
            keyErrors: {},
          });
          await new Promise((resolve) => setTimeout(resolve, keystrokeMs));
        }
      }),
    );

    // Dernier tick des positions, puis tous abandonnent : la course se termine.
    await new Promise((resolve) => setTimeout(resolve, 500));
    clients.forEach((client) => client.emit("race:giveUp"));
    await Promise.all(ended);

    latencies.sort((a, b) => a - b);
    return {
      participants,
      updates,
      samples: latencies.length,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      max: latencies.at(-1) ?? 0,
    };
  } finally {
    clients.forEach((client) => client.disconnect());
    await io.close();
    await db.delete(lobbies).where(inArray(lobbies.hostId, ids));
    await db.delete(users).where(inArray(users.id, ids));
  }
}

// Lancé en ligne de commande (et non importé par un test).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const participants = Number(process.argv[2] ?? MAX_PARTICIPANTS);
  try {
    const stats = await runLoadTest({ participants });
    console.log(`Participants          : ${stats.participants}`);
    console.log(`race:positions reçus  : ${stats.updates}`);
    console.log(`Frappes mesurées      : ${stats.samples}`);
    console.log(`Délai p50 / p95 / max : ${stats.p50} / ${stats.p95} / ${stats.max} ms`);
    const ok = stats.p95 < MAX_P95_MS;
    console.log(ok ? `OK (p95 < ${MAX_P95_MS} ms)` : `ÉCHEC (p95 ≥ ${MAX_P95_MS} ms)`);
    process.exitCode = ok ? 0 : 1;
  } finally {
    await db.$client.end();
  }
}
