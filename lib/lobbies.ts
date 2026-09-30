// Création des lobbys et participants connectés (LOB-1, LOB-2, LOB-4, LOB-5).
import { randomInt } from "node:crypto";
import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db/index.ts";
import { lobbies, lobbyParticipants, users } from "../db/schema.ts";

export type Lobby = typeof lobbies.$inferSelect;
export type Participant = { id: string; username: string };

// Sans 0/O, 1/I/L : le code se dicte et se recopie sans confusion.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

export function generateLobbyCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

// La saisie est insensible à la casse et aux espaces autour.
export function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}

export async function createLobby(
  hostId: string,
  visibility: "public" | "unlisted",
): Promise<Lobby> {
  // On réessaie en cas de collision avec un code existant.
  for (;;) {
    const [lobby] = await db
      .insert(lobbies)
      .values({ code: generateLobbyCode(), hostId, visibility })
      .onConflictDoNothing()
      .returning();
    if (lobby) return lobby;
  }
}

export async function findOpenLobby(code: string): Promise<Lobby | null> {
  const [lobby] = await db
    .select()
    .from(lobbies)
    .where(and(eq(lobbies.code, normalizeCode(code)), isNull(lobbies.closedAt)));
  return lobby ?? null;
}

// Courses publiques ouvertes où quelqu'un est connecté, les plus récentes d'abord.
export async function listPublicLobbies(): Promise<
  { code: string; hostName: string; participantCount: number }[]
> {
  return db
    .select({
      code: lobbies.code,
      hostName: users.username,
      participantCount: count(lobbyParticipants.userId),
    })
    .from(lobbies)
    .innerJoin(users, eq(lobbies.hostId, users.id))
    .innerJoin(lobbyParticipants, eq(lobbyParticipants.lobbyId, lobbies.id))
    .where(and(eq(lobbies.visibility, "public"), isNull(lobbies.closedAt)))
    .groupBy(lobbies.id, users.username)
    .orderBy(desc(lobbies.createdAt));
}

export async function addParticipant(lobbyId: string, userId: string) {
  await db
    .insert(lobbyParticipants)
    .values({ lobbyId, userId })
    .onConflictDoNothing();
}

export async function removeParticipant(lobbyId: string, userId: string) {
  await db
    .delete(lobbyParticipants)
    .where(
      and(
        eq(lobbyParticipants.lobbyId, lobbyId),
        eq(lobbyParticipants.userId, userId),
      ),
    );
}

export async function listParticipants(lobbyId: string): Promise<Participant[]> {
  return db
    .select({ id: users.id, username: users.username })
    .from(lobbyParticipants)
    .innerJoin(users, eq(lobbyParticipants.userId, users.id))
    .where(eq(lobbyParticipants.lobbyId, lobbyId))
    .orderBy(asc(lobbyParticipants.joinedAt));
}
