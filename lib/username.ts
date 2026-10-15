// Changement de nom (#67) : une fois par 30 jours, l'ancien nom reste au propriétaire pendant 30 jours.
import { and, eq, gt, ne, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { users } from "../db/schema.ts";
import type { User } from "./auth.ts";

export const RENAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

// error est une clé de traduction (Profile.username.errors).
export type RenameError = "cooldown" | "same" | "taken";

// Même durée pour l'attente et pour la réservation de l'ancien nom.
function cutoff(): Date {
  return new Date(Date.now() - RENAME_COOLDOWN_MS);
}

// Prochain changement permis ; null s'il est déjà permis.
export function nextRenameAt(user: Pick<User, "renamedAt">): Date | null {
  if (!user.renamedAt) return null;
  const next = new Date(user.renamedAt.getTime() + RENAME_COOLDOWN_MS);
  return next.getTime() > Date.now() ? next : null;
}

// Fin de la réservation de l'ancien nom, tant que « Revenir » est possible ; sinon null.
export function revertUntil(user: Pick<User, "previousUsername" | "renamedAt">): Date | null {
  return user.previousUsername ? nextRenameAt(user) : null;
}

// Un nom quitté il y a moins de 30 jours n'est pas libre pour les autres.
export async function isUsernameReserved(username: string, exceptUserId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(sql`lower(${users.previousUsername})`, username.toLowerCase()),
        gt(users.renamedAt, cutoff()),
        exceptUserId ? ne(users.id, exceptUserId) : undefined,
      ),
    );
  return row !== undefined;
}

// Le compte qui a quitté ce nom il y a moins de 30 jours : /profile/ancien-nom le redirige.
export async function findRenamedUser(username: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(sql`lower(${users.previousUsername})`, username.toLowerCase()),
        gt(users.renamedAt, cutoff()),
        eq(users.isGuest, false),
      ),
    );
  return user ?? null;
}

// username doit déjà respecter les règles de l'inscription (credentialsSchema).
export async function changeUsername(user: User, username: string): Promise<User | RenameError> {
  if (nextRenameAt(user)) return "cooldown";
  if (username === user.username) return "same";
  if (await isUsernameReserved(username, user.id)) return "taken";
  try {
    const [updated] = await db
      .update(users)
      .set({ username, previousUsername: user.username, renamedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();
    return updated;
  } catch (error) {
    if ((error as { cause?: { code?: string } }).cause?.code === "23505") return "taken";
    throw error;
  }
}

// Gratuit : renamedAt ne change pas, donc l'attente de 30 jours continue. Le nom quitté redevient libre.
export async function revertUsername(user: User): Promise<User | null> {
  if (!revertUntil(user)) return null;
  const [updated] = await db
    .update(users)
    .set({ username: user.previousUsername!, previousUsername: null })
    .where(eq(users.id, user.id))
    .returning();
  return updated;
}
