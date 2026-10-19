// Cookie httpOnly qui porte le jeton de session (AUTH-6).
import { cookies } from "next/headers";
import { cache } from "react";
import { SESSION_COOKIE, validateSessionToken, type User } from "./auth.ts";

export { SESSION_COOKIE };

// Présent quand « Se souvenir de moi » est décoché (AUTH-4) : le proxy ne
// prolonge alors pas le cookie, qui disparaît à la fermeture du navigateur.
export const TEMP_SESSION_COOKIE = "session_temp";

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

export async function setSessionCookie(token: string, expiresAt: Date, remember = true) {
  const store = await cookies();
  if (remember) {
    store.set(SESSION_COOKIE, token, { ...sessionCookieOptions, expires: expiresAt });
    store.delete(TEMP_SESSION_COOKIE);
  } else {
    store.set(SESSION_COOKIE, token, sessionCookieOptions);
    store.set(TEMP_SESSION_COOKIE, "1", sessionCookieOptions);
  }
}

export async function deleteSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(TEMP_SESSION_COOKIE);
}

// Mis en cache pour ne valider la session qu'une fois par requête.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? validateSessionToken(token) : null;
});
