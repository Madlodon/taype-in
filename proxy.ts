import { NextResponse, type NextRequest } from "next/server";
import { SESSION_DURATION_MS } from "@/lib/auth";
import { SESSION_COOKIE, sessionCookieOptions, TEMP_SESSION_COOKIE } from "@/lib/session-cookie";

// Repousse l'expiration du cookie à chaque visite, comme la session en base,
// sauf pour une session qui doit finir à la fermeture du navigateur.
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (request.method === "GET" && token && !request.cookies.has(TEMP_SESSION_COOKIE)) {
    response.cookies.set(SESSION_COOKIE, token, {
      ...sessionCookieOptions,
      maxAge: SESSION_DURATION_MS / 1000,
    });
  }
  return response;
}

// Les photos de profil et les préchargements de liens n'ont pas besoin de la
// session : une réponse encore en route remettrait sinon le cookie après une
// déconnexion. Le retour OAuth pose lui-même un nouveau cookie de session.
export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|avatars/|auth/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
