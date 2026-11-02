// Serveur personnalisé : Next.js et Socket.IO sur le même port (ADR 0001).
import { createServer } from "node:http";
import next from "next";
import { createSocketServer } from "./lib/socket-server.ts";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, port });
const handle = app.getRequestHandler();

// Une promesse rejetée sans catch est journalisée au lieu d'arrêter le processus et ses courses en mémoire.
process.on("unhandledRejection", (reason) => {
  console.error("Promesse rejetée non gérée :", reason);
});

await app.prepare();

const httpServer = createServer((req, res) => handle(req, res));
// MAX_WPM=Infinity accepte la saisie instantanée (tests E2E).
const maxWpm = process.env.MAX_WPM;
createSocketServer(httpServer, {
  ...(maxWpm && { maxWpm: Number(maxWpm) }),
});

httpServer.listen(port, () => {
  console.log(`> Serveur prêt sur http://localhost:${port}`);
});
