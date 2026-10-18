// Données de démonstration (TECH-04) : corpus de textes, utilisateurs (dont le compte de démo)
// et historique de courses. Le corpus vient des migrations, à appliquer avant. Relancer le script efface les données de démo et les recrée ;
// les autres comptes ne sont pas touchés.
// Usage : bun run db:seed
import { fileURLToPath } from "node:url";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db/index.ts";
import { lobbies, races, results, texts, users } from "../db/schema.ts";
import { signUp } from "../lib/auth.ts";
import { seededRandom } from "../lib/bots.ts";
import { lockLoadout, type Loadout } from "../lib/garage-items.ts";
import { generateLobbyCode } from "../lib/lobbies.ts";
import { clampRankLevel, rankMoves } from "../lib/ranks.ts";
import { cutText } from "../lib/texts.ts";
import { accuracy, wordsPerMinute } from "../lib/typing.ts";
import { levelFromXp, raceXp } from "../lib/xp.ts";

export const DEMO_USERNAME = "demo";
export const DEMO_PASSWORD = "taype-in-demo";

// Adversaires du compte de démo : vitesse de base (MPM) et garage voulu.
// Ils n'ont pas de mot de passe : seul le compte de démo sert à se connecter.
const RIVALS: { username: string; wpm: number; loadout: Loadout }[] = [
  { username: "mia_types", wpm: 38, loadout: { car: "octane", boost: "standard", hat: "cone", ball: "beach", stadium: "diorama" } },
  { username: "leo_fast", wpm: 48, loadout: { car: "merc", boost: "flames", hat: "cone", ball: "beach", stadium: "cutaway" } },
  { username: "zoe_keys", wpm: 57, loadout: { car: "merc", boost: "flames", hat: "none", ball: "emerald", stadium: "diorama" } },
  { username: "sam_rocket", wpm: 66, loadout: { car: "merc", boost: "ion", hat: "cone", ball: "emerald", stadium: "top-down" } },
  { username: "noa_boost", wpm: 78, loadout: { car: "octane", boost: "flames", hat: "none", ball: "emerald", stadium: "cutaway" } },
];

const DEMO_LOADOUT: Loadout = { car: "merc", boost: "flames", hat: "cone", ball: "emerald", stadium: "diorama" };

// Le compte de démo progresse au fil des courses, pour le graphique du profil.
const DEMO_START_WPM = 42;
const DEMO_END_WPM = 64;

export const SEED_USERNAMES = [DEMO_USERNAME, ...RIVALS.map((rival) => rival.username)];

const RACE_COUNT = 24;
// Courses regroupées en sessions de 4 (moins de 30 min d'écart), une session par jour.
const RACES_PER_SESSION = 4;
const MINUTES_BETWEEN_RACES = 5;

// Graine fixe : relancer le script donne le même historique.
const SEED = 135;

type Player = { id: string; wpm: number };

// typedLength sert seulement à classer les abandons.
type SimulatedResult = { row: Omit<typeof results.$inferInsert, "raceId" | "rank">; typedLength: number };

// Efface les comptes de démo, leurs lobbies (donc leurs courses) et leurs résultats.
export async function deleteSeedData() {
  const rows = await db.select({ id: users.id }).from(users).where(inArray(users.username, SEED_USERNAMES));
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return;
  await db.delete(lobbies).where(inArray(lobbies.hostId, ids));
  await db.delete(users).where(inArray(users.id, ids));
}

function simulate(player: Player, content: string, random: () => number): SimulatedResult {
  const gaveUp = random() < 0.06;
  const typedLength = gaveUp ? Math.floor(content.length * (0.3 + random() * 0.4)) : content.length;
  const wpm = player.wpm * (0.9 + random() * 0.2);
  const durationMs = Math.round((typedLength * 12_000) / wpm);
  const errors = Math.round(typedLength * (0.01 + random() * 0.05));
  const keys = typedLength + errors;

  // Fautes sur des caractères du texte, comptées par caractère attendu (heatmap, touches difficiles).
  const keyErrors: Record<string, number> = {};
  for (let i = 0; i < errors; i++) {
    const character = content[Math.floor(random() * typedLength)];
    keyErrors[character] = (keyErrors[character] ?? 0) + 1;
  }

  // Une valeur par seconde : départ plus lent, puis autour de la vitesse moyenne.
  const seconds = Math.ceil(durationMs / 1000);
  const wpmSeries = Array.from({ length: seconds }, (_, i) =>
    Math.round(wpm * Math.min(1, (i + 1) / 4) * (0.85 + random() * 0.3)),
  );

  const row = {
    userId: player.id,
    wpm: wordsPerMinute(typedLength, durationMs),
    rawWpm: wordsPerMinute(keys, durationMs),
    accuracy: accuracy(keys, errors),
    durationMs,
    errorCount: errors,
    finished: !gaveUp,
    gaveUp,
    keyErrors,
    wpmSeries,
  };
  return { row, typedLength };
}

export async function seed({ now = new Date() } = {}) {
  await deleteSeedData();
  const random = seededRandom(SEED);

  // Le corpus vient des migrations (0003, 0021) : le script vérifie seulement qu'il est là.
  const corpus = await db.select().from(texts);
  if (corpus.length === 0) throw new Error("La banque de textes est vide : migrations manquantes ?");

  const demo = await signUp(DEMO_USERNAME, DEMO_PASSWORD);
  if (demo === "taken") throw new Error(`Le nom ${DEMO_USERNAME} est réservé par un autre compte.`);
  const rivals = await db
    .insert(users)
    .values(RIVALS.map((rival) => ({ username: rival.username })))
    .returning({ id: users.id });

  const [lobby] = await db
    .insert(lobbies)
    .values({ code: generateLobbyCode(), visibility: "unlisted", hostId: demo.id, closedAt: now })
    .returning();

  const xp = new Map<string, number>([[demo.id, 0], ...rivals.map(({ id }) => [id, 0] as const)]);
  // Rang de départ selon la vitesse : les plus rapides partent plus haut.
  const rankLevel = new Map<string, number>([
    [demo.id, 20],
    ...rivals.map(({ id }, i) => [id, 10 + Math.round(RIVALS[i].wpm / 3)] as const),
  ]);

  const firstDay = new Date(now.getTime() - (RACE_COUNT / RACES_PER_SESSION) * 24 * 60 * 60 * 1000);
  for (let index = 0; index < RACE_COUNT; index++) {
    const session = Math.floor(index / RACES_PER_SESSION);
    const startedAt = new Date(
      firstDay.getTime() +
        session * 24 * 60 * 60 * 1000 +
        (index % RACES_PER_SESSION) * MINUTES_BETWEEN_RACES * 60 * 1000,
    );

    const text = corpus[Math.floor(random() * corpus.length)];
    const content = cutText(text.content, random() < 0.5 ? 50 : 100);

    // Le compte de démo et 2 à 5 adversaires tirés au hasard.
    const demoWpm = DEMO_START_WPM + ((DEMO_END_WPM - DEMO_START_WPM) * index) / (RACE_COUNT - 1);
    const opponents = rivals
      .map(({ id }, i) => ({ id, wpm: RIVALS[i].wpm, order: random() }))
      .sort((a, b) => a.order - b.order)
      .slice(0, 2 + Math.floor(random() * 4));
    const players: Player[] = [{ id: demo.id, wpm: demoWpm }, ...opponents];

    // Ceux qui finissent, du plus rapide au plus lent, puis les abandons selon le texte tapé.
    const simulated = players
      .map((player) => simulate(player, content, random))
      .sort((a, b) =>
        a.row.finished !== b.row.finished
          ? Number(b.row.finished) - Number(a.row.finished)
          : a.row.finished
            ? a.row.durationMs - b.row.durationMs
            : b.typedLength - a.typedLength,
      );

    const endedAt = new Date(startedAt.getTime() + Math.max(...simulated.map(({ row }) => row.durationMs)));
    const [race] = await db
      .insert(races)
      .values({
        lobbyId: lobby.id,
        textId: text.id,
        content,
        language: text.language,
        errorMode: "blocking",
        timeLimitSeconds: lobby.timeLimitSeconds,
        createdAt: new Date(startedAt.getTime() - 5000),
        startedAt,
        endedAt,
      })
      .returning({ id: races.id });

    await db.insert(results).values(
      simulated.map(({ row }, i) => ({ ...row, raceId: race.id, rank: i + 1 })),
    );

    const moves = rankMoves(simulated.length);
    simulated.forEach(({ row }, i) => {
      xp.set(row.userId, xp.get(row.userId)! + raceXp(i + 1, simulated.length, row.finished));
      rankLevel.set(row.userId, clampRankLevel(rankLevel.get(row.userId)! + moves[i]));
    });
  }

  // XP et rang cumulés ; le garage ne garde que les objets débloqués au niveau atteint.
  const loadouts = new Map<string, Loadout>([[demo.id, DEMO_LOADOUT], ...rivals.map(({ id }, i) => [id, RIVALS[i].loadout] as const)]);
  for (const [id, total] of xp) {
    await db
      .update(users)
      .set({ xp: total, rankLevel: rankLevel.get(id)!, ...lockLoadout(loadouts.get(id)!, levelFromXp(total)) })
      .where(eq(users.id, id));
  }

  return { users: SEED_USERNAMES.length, races: RACE_COUNT };
}

// Lancé en ligne de commande (et non importé par un test).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const summary = await seed();
    console.log(`Utilisateurs : ${summary.users}`);
    console.log(`Courses      : ${summary.races}`);
    console.log(`Compte de démo : ${DEMO_USERNAME} / ${DEMO_PASSWORD}`);
  } finally {
    await db.$client.end();
  }
}
