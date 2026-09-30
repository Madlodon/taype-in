// Cookie httpOnly qui porte le jeton de session (AUTH-6).
import { cookies } from "next/headers";
import { cache } from "react";
import { SESSION_COOKIE, validateSessionToken, type User } from "./auth.ts";

export { SESSION_COOKIE };

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    ...sessionCookieOptions,
    expires: expiresAt,
  });
}

export async function deleteSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

// Mis en cache pour ne valider la session qu'une fois par requête.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? validateSessionToken(token) : null;
});
