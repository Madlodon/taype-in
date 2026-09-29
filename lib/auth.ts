// Comptes, invités et sessions (AUTH-1, AUTH-3, AUTH-5, AUTH-6).
import { createHash, randomBytes, randomInt } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.ts";
import { sessions, users } from "../db/schema.ts";

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
// Sous ce seuil, la session est prolongée de 30 jours à chaque utilisation.
const RENEW_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000;

export const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Le nom d'utilisateur doit avoir au moins 3 caractères.")
    .max(20, "Le nom d'utilisateur doit avoir au plus 20 caractères.")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Seulement des lettres sans accent, des chiffres et _.",
    ),
  password: z
    .string()
    .min(8, "Le mot de passe doit avoir au moins 8 caractères.")
    // Limite le coût du hachage.
    .max(128, "Le mot de passe doit avoir au plus 128 caractères."),
});

export type User = typeof users.$inferSelect;

export async function signUp(
  username: string,
  password: string,
): Promise<User | "taken"> {
  try {
    const [user] = await db
      .insert(users)
      .values({ username, passwordHash: await hash(password) })
      .returning();
    return user;
  } catch (error) {
    if ((error as { cause?: { code?: string } }).cause?.code === "23505") {
      return "taken";
    }
    throw error;
  }
}

export async function logIn(
  username: string,
  password: string,
): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`);
  // Les invités n'ont pas de mot de passe.
  if (!user?.passwordHash) return null;
  return (await verify(user.passwordHash, password)) ? user : null;
}

export async function createGuest(): Promise<User> {
  // Le tiret empêche un compte de prendre ce nom ; on réessaie en cas de collision.
  for (;;) {
    const username = `Invité-${randomInt(100_000, 1_000_000)}`;
    const [user] = await db
      .insert(users)
      .values({ username, isGuest: true })
      .onConflictDoNothing()
      .returning();
    if (user) return user;
  }
}

// La base garde seulement le hash du jeton : une fuite ne donne pas de session.
function sessionIdFromToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db
    .insert(sessions)
    .values({ id: sessionIdFromToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function validateSessionToken(token: string): Promise<User | null> {
  const id = sessionIdFromToken(token);
  const [row] = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, id));
  if (!row) return null;

  const remaining = row.expiresAt.getTime() - Date.now();
  if (remaining <= 0) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  if (remaining < RENEW_THRESHOLD_MS) {
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_DURATION_MS) })
      .where(eq(sessions.id, id));
  }
  return row.user;
}

export async function invalidateSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionIdFromToken(token)));
}
