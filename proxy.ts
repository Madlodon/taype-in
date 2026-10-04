import { NextResponse, type NextRequest } from "next/server";
import { SESSION_DURATION_MS } from "@/lib/auth";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session-cookie";

// Repousse l'expiration du cookie à chaque visite, comme la session en base.
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (request.method === "GET" && token) {
    response.cookies.set(SESSION_COOKIE, token, {
      ...sessionCookieOptions,
      maxAge: SESSION_DURATION_MS / 1000,
    });
  }
  return response;
}

// Les photos de profil n'ont pas besoin de la session : une image encore en route
// remettrait sinon le cookie après une déconnexion.
export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico|avatars/).*)",
};
