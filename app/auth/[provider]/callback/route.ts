import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createSession, safeNextPath } from "@/lib/auth";
import {
  callbackUrl,
  encodePending,
  fetchProfile,
  findOAuthUser,
  isEnabledProvider,
  PENDING_COOKIE,
  PENDING_DURATION_MS,
  STATE_COOKIE,
  suggestUsername,
} from "@/lib/oauth";
import { sessionCookieOptions, setSessionCookie } from "@/lib/session-cookie";

const FAILED = "/login?error=oauthFailed";

function readState(value: string | undefined): { provider: string; state: string; next: string } | null {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

// Retour du fournisseur : connecte le joueur déjà relié, sinon lui fait choisir son nom.
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const store = await cookies();
  const saved = readState(store.get(STATE_COOKIE)?.value);
  store.delete(STATE_COOKIE);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  // Le joueur qui refuse l'accès revient sans code.
  if (!isEnabledProvider(provider) || !saved || saved.provider !== provider || saved.state !== state || !code) {
    redirect(FAILED);
  }

  const profile = await fetchProfile(provider, code, callbackUrl(request.nextUrl.origin, provider));
  if (!profile) redirect(FAILED);
  const next = safeNextPath(saved.next);

  const user = await findOAuthUser(provider, profile.id);
  if (user) {
    const { token, expiresAt } = await createSession(user.id);
    await setSessionCookie(token, expiresAt);
    redirect(next);
  }

  const pending = { provider, id: profile.id, avatarUrl: profile.avatarUrl, username: suggestUsername(profile.username), next };
  store.set(PENDING_COOKIE, encodePending(pending), { ...sessionCookieOptions, maxAge: PENDING_DURATION_MS / 1000 });
  redirect("/signup/oauth");
}
