// Applique les migrations en attente. Roulé au démarrage du conteneur de production.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const client = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });

await migrate(drizzle(client), { migrationsFolder: "db/migrations" });
await client.end();
