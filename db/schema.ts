import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const languageEnum = pgEnum("language", ["fr", "en"]);
export const lobbyVisibilityEnum = pgEnum("lobby_visibility", [
  "public",
  "unlisted",
  "private",
]);
export const errorModeEnum = pgEnum("error_mode", ["blocking", "tolerant"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: text("username").notNull(),
    // Null pour les invités et les comptes OAuth.
    passwordHash: text("password_hash"),
    isGuest: boolean("is_guest").notNull().default(false),
    // Garage (#34) : texte libre, les valeurs permises sont dans lib/garage.ts.
    car: text("car").notNull().default("octane"),
    boost: text("boost").notNull().default("standard"),
    hat: text("hat").notNull().default("none"),
    ball: text("ball").notNull().default("none"),
    stadium: text("stadium").notNull().default("diorama"),
    // Rang façon Rocket League (#99) : 0 = Bronze I div. I, voir lib/ranks.ts.
    rankLevel: integer("rank_level").notNull().default(0),
    // XP cumulée (#35) ; le niveau en découle, voir lib/xp.ts.
    xp: integer("xp").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Unicité insensible à la casse : « Alex » et « alex » sont le même nom.
    uniqueIndex("users_username_lower_idx").on(sql`lower(${table.username})`),
  ],
);

// postgres-js renvoie un Buffer pour une colonne bytea.
const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

// Photo de profil (PROF-1) ; tout l'accès passe par lib/avatars.ts.
export const avatars = pgTable("avatars", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(),
  data: bytea("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// Banque de textes prédéfinis (TXT-3).
export const texts = pgTable("texts", {
  id: uuid("id").primaryKey().defaultRandom(),
  language: languageEnum("language").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const lobbies = pgTable("lobbies", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  visibility: lobbyVisibilityEnum("visibility").notNull(),
  hostId: uuid("host_id")
    .notNull()
    .references(() => users.id),
  // Langue et nombre de mots du texte, choisis à la création (TXT-1, TXT-2).
  textLanguage: languageEnum("text_language").notNull().default("fr"),
  textLength: integer("text_length").notNull().default(100),
  // Mode d'erreur choisi à la création, copié dans chaque course (ERR-1).
  errorMode: errorModeEnum("error_mode").notNull().default("blocking"),
  // Minuterie de la course, 5 min par défaut ; null = pas de minuterie (CRS-4).
  timeLimitSeconds: integer("time_limit_seconds").default(300),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Null tant que le lobby est ouvert (LOB-10).
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const lobbyParticipants = pgTable(
  "lobby_participants",
  {
    lobbyId: uuid("lobby_id")
      .notNull()
      .references(() => lobbies.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isSpectator: boolean("is_spectator").notNull().default(false),
    // Sert à passer le rôle d'hôte au plus ancien participant.
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.lobbyId, table.userId] })],
);

// Liens d'invitation à usage unique d'une course privée (LOB-3).
export const lobbyInvites = pgTable(
  "lobby_invites",
  {
    token: text("token").primaryKey(),
    lobbyId: uuid("lobby_id")
      .notNull()
      .references(() => lobbies.id, { onDelete: "cascade" }),
    // Null tant que le lien n'a pas servi ; ensuite, seule cette personne peut l'utiliser.
    usedBy: uuid("used_by").references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("lobby_invites_lobby_id_idx").on(table.lobbyId)],
);

// Une ligne par course ; porte les paramètres choisis par l'hôte (LOB-9).
export const races = pgTable("races", {
  id: uuid("id").primaryKey().defaultRandom(),
  lobbyId: uuid("lobby_id")
    .notNull()
    .references(() => lobbies.id, { onDelete: "cascade" }),
  // Texte d'origine dans la banque ; null pour un texte écrit par l'hôte.
  textId: uuid("text_id").references(() => texts.id, { onDelete: "set null" }),
  // Copie exacte du texte tapé (coupé à la longueur choisie ou écrit par l'hôte).
  content: text("content").notNull(),
  language: languageEnum("language").notNull(),
  errorMode: errorModeEnum("error_mode").notNull(),
  // Null = pas de minuterie (CRS-4).
  timeLimitSeconds: integer("time_limit_seconds"),
  bonusesEnabled: boolean("bonuses_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

// Résultats des participants humains ; les bots occupent un rang sans ligne.
export const results = pgTable(
  "results",
  {
    raceId: uuid("race_id")
      .notNull()
      .references(() => races.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    wpm: real("wpm").notNull(),
    // Pourcentage de 0 à 100.
    accuracy: real("accuracy").notNull(),
    durationMs: integer("duration_ms").notNull(),
    errorCount: integer("error_count").notNull(),
    finished: boolean("finished").notNull(),
    // Nombre de fautes par touche, pour la heatmap et les touches difficiles.
    keyErrors: jsonb("key_errors")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
  },
  (table) => [
    primaryKey({ columns: [table.raceId, table.userId] }),
    // Historique d'un utilisateur (PROF-2).
    index("results_user_id_idx").on(table.userId),
    check("results_rank_positive", sql`${table.rank} >= 1`),
    check(
      "results_accuracy_range",
      sql`${table.accuracy} between 0 and 100`,
    ),
  ],
);
