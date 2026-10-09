// Connexion avec Discord ou GitHub (AUTH-2) : flux « authorization code » d'OAuth 2.
// La photo du compte externe devient la photo de profil à la création (PROF-1).
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { oauthAccounts, users } from "../db/schema.ts";
import type { User } from "./auth.ts";
import { saveAvatar } from "./avatars.ts";

export const OAUTH_PROVIDERS = ["discord", "github"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

// Noms de marque : pas traduits.
export const PROVIDER_NAMES: Record<OAuthProvider, string> = { discord: "Discord", github: "GitHub" };

// Ce qu'on garde du compte externe.
export type OAuthProfile = {
  provider: OAuthProvider;
  id: string;
  username: string;
  avatarUrl: string | null;
};

const PROVIDERS = {
  discord: {
    authorizeUrl: "https://discord.com/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    profileUrl: "https://discord.com/api/users/@me",
    // Juste l'identité : pas de courriel ni de serveurs.
    scope: "identify",
  },
  github: {
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    profileUrl: "https://api.github.com/user",
    // Vide : le profil public suffit.
    scope: "",
  },
} as const;

// Les clés viennent des applications OAuth créées chez Discord et GitHub.
function credentials(provider: OAuthProvider) {
  const prefix = provider.toUpperCase();
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

// Un fournisseur sans clés n'est pas offert (ex. en développement).
export function enabledProviders(): OAuthProvider[] {
  return OAUTH_PROVIDERS.filter((provider) => credentials(provider));
}

export function isEnabledProvider(value: string): value is OAuthProvider {
  return (enabledProviders() as string[]).includes(value);
}

// Doit être identique au départ et au retour, et inscrite chez le fournisseur.
// APP_URL en production : derrière Caddy, l'origine vue par Next n'est pas l'adresse publique.
export function callbackUrl(origin: string, provider: OAuthProvider): string {
  return `${process.env.APP_URL || origin}/auth/${provider}/callback`;
}

// Jeton aléatoire gardé en cookie au départ et comparé au retour (protection CSRF).
export const STATE_COOKIE = "oauth_state";
export const STATE_DURATION_MS = 10 * 60 * 1000;

export function authorizeUrl(provider: OAuthProvider, redirectUri: string, state: string): string {
  const url = new URL(PROVIDERS[provider].authorizeUrl);
  url.search = new URLSearchParams({
    client_id: credentials(provider)!.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: PROVIDERS[provider].scope,
    state,
  }).toString();
  return url.toString();
}

// Échange le code reçu contre un jeton, puis lit le profil ; null si le fournisseur refuse.
export async function fetchProfile(
  provider: OAuthProvider,
  code: string,
  redirectUri: string,
): Promise<OAuthProfile | null> {
  const { clientId, clientSecret } = credentials(provider)!;
  const tokenResponse = await fetch(PROVIDERS[provider].tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenResponse.ok) return null;
  const { access_token: accessToken } = (await tokenResponse.json()) as { access_token?: string };
  if (!accessToken) return null;

  const profileResponse = await fetch(PROVIDERS[provider].profileUrl, {
    // GitHub refuse les requêtes sans User-Agent.
    headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "taype-in" },
  });
  if (!profileResponse.ok) return null;
  const data = await profileResponse.json();

  if (provider === "discord") {
    const { id, username, avatar } = data as { id: string; username: string; avatar: string | null };
    const avatarUrl = avatar ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=256` : null;
    return { provider, id, username, avatarUrl };
  }
  const { id, login, avatar_url: avatarUrl } = data as { id: number; login: string; avatar_url: string | null };
  return { provider, id: String(id), username: login, avatarUrl: avatarUrl ?? null };
}

// Nom proposé à partir du compte externe ; le joueur peut le changer avant de créer son compte.
export function suggestUsername(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 20);
}

export async function findOAuthUser(provider: OAuthProvider, providerUserId: string): Promise<User | null> {
  const [row] = await db
    .select({ user: users })
    .from(oauthAccounts)
    .innerJoin(users, eq(oauthAccounts.userId, users.id))
    .where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerUserId, providerUserId)));
  return row?.user ?? null;
}

// Comme signUp, sans mot de passe : un invité garde sa ligne (AUTH-7).
export async function signUpWithOAuth(
  profile: Pick<OAuthProfile, "provider" | "id" | "avatarUrl">,
  username: string,
  guestId?: string,
): Promise<User | "taken"> {
  let user: User;
  try {
    user = await db.transaction(async (tx) => {
      const [row] = guestId
        ? await tx
            .update(users)
            .set({ username, isGuest: false })
            .where(and(eq(users.id, guestId), eq(users.isGuest, true)))
            .returning()
        : await tx.insert(users).values({ username }).returning();
      await tx.insert(oauthAccounts).values({ provider: profile.provider, providerUserId: profile.id, userId: row.id });
      return row;
    });
  } catch (error) {
    if ((error as { cause?: { code?: string } }).cause?.code === "23505") return "taken";
    throw error;
  }
  if (profile.avatarUrl) await copyAvatar(user.id, profile.avatarUrl);
  return user;
}

// Sans photo si le téléchargement échoue : le compte est quand même créé.
async function copyAvatar(userId: string, url: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) return;
    await saveAvatar(userId, new File([await response.arrayBuffer()], "avatar"));
  } catch {
    // Les initiales restent affichées.
  }
}

// Entre le retour du fournisseur et le choix du nom, le compte externe attend dans un
// cookie signé : le joueur ne peut pas le modifier.
export const PENDING_COOKIE = "oauth_pending";
export const PENDING_DURATION_MS = 10 * 60 * 1000;

export type PendingSignUp = Pick<OAuthProfile, "provider" | "id" | "avatarUrl"> & {
  username: string;
  next: string;
};

// Clé dérivée du poivre : pas de nouveau secret à gérer.
function sign(payload: string): string {
  const pepper = process.env.PASSWORD_PEPPER;
  if (!pepper) throw new Error("PASSWORD_PEPPER n'est pas défini.");
  const key = createHmac("sha256", pepper).update("oauth-pending").digest();
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function encodePending(pending: PendingSignUp): string {
  const payload = Buffer.from(JSON.stringify({ ...pending, expiresAt: Date.now() + PENDING_DURATION_MS })).toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

export function decodePending(value: string | undefined): PendingSignUp | null {
  const [payload, signature] = value?.split(".") ?? [];
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  const { expiresAt, ...pending } = JSON.parse(Buffer.from(payload, "base64url").toString()) as PendingSignUp & {
    expiresAt: number;
  };
  return expiresAt > Date.now() ? pending : null;
}
