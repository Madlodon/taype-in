// Création et fermeture des lobbys, invitations et participants connectés (LOB-1 à LOB-5, LOB-7, LOB-10).
import { randomBytes, randomInt } from "node:crypto";
import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db/index.ts";
import { lobbies, lobbyInvites, lobbyParticipants, users } from "../db/schema.ts";

export type Lobby = typeof lobbies.$inferSelect;
export type Participant = { id: string; username: string };

// Sans 0/O, 1/I/L : le code se dicte et se recopie sans confusion.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
// LOB-6 : 300 participants au maximum.
export const MAX_PARTICIPANTS = 300;
// Un lien par participant possible.
export const MAX_INVITES = MAX_PARTICIPANTS;

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
  visibility: Lobby["visibility"],
  text?: Pick<Lobby, "textLanguage" | "textLength">,
): Promise<Lobby> {
  // On réessaie en cas de collision avec un code existant.
  for (;;) {
    const [lobby] = await db
      .insert(lobbies)
      .values({ code: generateLobbyCode(), hostId, visibility, ...text })
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

// Un lobby fermé disparaît de la liste publique et son code ne fonctionne plus.
export async function closeLobby(lobbyId: string) {
  await db
    .update(lobbies)
    .set({ closedAt: new Date() })
    .where(and(eq(lobbies.id, lobbyId), isNull(lobbies.closedAt)));
}

// Une course privée n'est accessible qu'à l'hôte et à ceux qui ont utilisé un lien.
export async function canEnterLobby(lobby: Lobby, userId: string): Promise<boolean> {
  if (lobby.visibility !== "private" || lobby.hostId === userId) return true;
  const [invite] = await db
    .select({ token: lobbyInvites.token })
    .from(lobbyInvites)
    .where(and(eq(lobbyInvites.lobbyId, lobby.id), eq(lobbyInvites.usedBy, userId)));
  return Boolean(invite);
}

export async function createInvites(lobbyId: string, count: number): Promise<string[]> {
  const rows = Array.from({ length: count }, () => ({
    token: randomBytes(16).toString("base64url"),
    lobbyId,
  }));
  await db.insert(lobbyInvites).values(rows);
  return rows.map((row) => row.token);
}

export async function listInvites(
  lobbyId: string,
): Promise<{ token: string; used: boolean }[]> {
  const rows = await db
    .select({ token: lobbyInvites.token, usedBy: lobbyInvites.usedBy })
    .from(lobbyInvites)
    .where(eq(lobbyInvites.lobbyId, lobbyId))
    .orderBy(asc(lobbyInvites.createdAt));
  return rows.map((row) => ({ token: row.token, used: row.usedBy !== null }));
}

// Lien valide pour cet utilisateur : lobby ouvert, et lien libre ou déjà à lui.
export async function findInviteLobby(token: string, userId?: string): Promise<Lobby | null> {
  const [row] = await db
    .select({ lobby: lobbies, usedBy: lobbyInvites.usedBy })
    .from(lobbyInvites)
    .innerJoin(lobbies, eq(lobbyInvites.lobbyId, lobbies.id))
    .where(and(eq(lobbyInvites.token, token), isNull(lobbies.closedAt)));
  if (!row || (row.usedBy !== null && row.usedBy !== userId)) return null;
  return row.lobby;
}

// Réserve le lien pour l'utilisateur et renvoie le lobby, ou null si le lien n'est plus valide.
export async function claimInvite(token: string, userId: string): Promise<Lobby | null> {
  const lobby = await findInviteLobby(token, userId);
  if (!lobby) return null;
  // Déjà admis (hôte ou autre lien) : on ne gaspille pas ce lien.
  if (await canEnterLobby(lobby, userId)) return lobby;

  // La condition sur used_by empêche deux personnes de prendre le même lien en même temps.
  const [taken] = await db
    .update(lobbyInvites)
    .set({ usedBy: userId })
    .where(and(eq(lobbyInvites.token, token), isNull(lobbyInvites.usedBy)))
    .returning();
  return taken ? lobby : null;
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
