// Photo de profil (PROF-1) : tout le stockage est ici pour pouvoir le déplacer plus tard.
// Gardée dans Postgres (bytea) pour rester gratuit.
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { avatars, users } from "../db/schema.ts";

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type AvatarImage = { contentType: string; body: Uint8Array<ArrayBuffer> | string; etag: string };

// Le type vient des premiers octets du fichier, pas de ce que le navigateur annonce.
export function detectImageType(bytes: Uint8Array): (typeof AVATAR_TYPES)[number] | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

// error est une clé de traduction (Profile.photo.errors).
export async function saveAvatar(userId: string, file: File): Promise<{ error?: "tooLarge" | "type" }> {
  if (file.size > MAX_AVATAR_BYTES) return { error: "tooLarge" };
  const data = Buffer.from(await file.arrayBuffer());
  const contentType = detectImageType(data);
  if (!contentType) return { error: "type" };
  const row = { userId, contentType, data, updatedAt: new Date() };
  await db.insert(avatars).values(row).onConflictDoUpdate({ target: avatars.userId, set: row });
  return {};
}

export async function removeAvatar(userId: string): Promise<void> {
  await db.delete(avatars).where(eq(avatars.userId, userId));
}

// La photo du joueur, ou ses initiales s'il n'en a pas ; null si le joueur n'existe pas.
export async function getAvatarImage(userId: string): Promise<AvatarImage | null> {
  const [row] = await db
    .select({ username: users.username, contentType: avatars.contentType, data: avatars.data, updatedAt: avatars.updatedAt })
    .from(users)
    .leftJoin(avatars, eq(avatars.userId, users.id))
    .where(eq(users.id, userId));
  if (!row) return null;
  if (row.data && row.contentType && row.updatedAt) {
    return { contentType: row.contentType, body: new Uint8Array(row.data), etag: `"${row.updatedAt.getTime()}"` };
  }
  return { contentType: "image/svg+xml", body: initialsSvg(row.username), etag: `"initials-${encodeURIComponent(row.username)}"` };
}

// Change à chaque nouvelle photo : sert à rafraîchir l'image dans le navigateur.
export async function getAvatarVersion(userId: string): Promise<number | null> {
  const [row] = await db
    .select({ updatedAt: avatars.updatedAt })
    .from(avatars)
    .where(eq(avatars.userId, userId));
  return row ? row.updatedAt.getTime() : null;
}

// Sans photo : les initiales du nom (« alex_martin » → AM, « alex » → AL).
export function initials(username: string): string {
  const parts = username.split(/[_-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : username.slice(0, 2);
  return letters.toUpperCase();
}

// Fonds assez foncés pour que le texte blanc reste lisible (WCAG AA).
const INITIALS_COLORS = ["#1d4ed8", "#c2410c", "#15803d", "#7e22ce", "#be123c", "#0f766e", "#a16207", "#4338ca"];

// Toujours la même couleur pour un même nom.
export function initialsColor(username: string): string {
  let hash = 0;
  for (const char of username.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return INITIALS_COLORS[hash % INITIALS_COLORS.length];
}

export function initialsSvg(username: string): string {
  const text = initials(username).replace(/[&<>]/g, (char) => `&#${char.charCodeAt(0)};`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${initialsColor(username)}"/><text x="50" y="50" dy=".35em" text-anchor="middle" font-family="system-ui, sans-serif" font-size="42" font-weight="700" fill="#fff">${text}</text></svg>`;
}
