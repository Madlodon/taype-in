import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth";
import { authorizeUrl, callbackUrl, isEnabledProvider, STATE_COOKIE, STATE_DURATION_MS } from "@/lib/oauth";
import { sessionCookieOptions } from "@/lib/session-cookie";

// Départ de la connexion Discord ou GitHub (AUTH-2) : envoie le joueur chez le fournisseur.
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isEnabledProvider(provider)) return new Response(null, { status: 404 });

  const state = randomBytes(16).toString("base64url");
  const next = safeNextPath(request.nextUrl.searchParams.get("next") ?? "");
  (await cookies()).set(STATE_COOKIE, JSON.stringify({ provider, state, next }), {
    ...sessionCookieOptions,
    maxAge: STATE_DURATION_MS / 1000,
  });
  redirect(authorizeUrl(provider, callbackUrl(request.nextUrl.origin, provider), state));
}
