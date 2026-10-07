// Serveur personnalisé : Next.js et Socket.IO sur le même port (ADR 0001).
import { createServer } from "node:http";
import next from "next";
import { createSocketServer } from "./lib/socket-server.ts";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, port });
const handle = app.getRequestHandler();

await app.prepare();

const httpServer = createServer((req, res) => handle(req, res));
// GOAL_CHANCE=0 désactive les buts (tests E2E).
const goalChance = process.env.GOAL_CHANCE;
createSocketServer(httpServer, goalChance ? { goalChance: Number(goalChance) } : {});

httpServer.listen(port, () => {
  console.log(`> Serveur prêt sur http://localhost:${port}`);
});
