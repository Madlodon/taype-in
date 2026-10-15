"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createGuest, createSession } from "@/lib/auth";
import { getClientIp } from "@/lib/client-ip";
import {
  canEnterLobby,
  claimInvite,
  createInvites,
  createLobby,
  findOpenLobby,
  MAX_INVITES,
  parseLobbySettings,
} from "@/lib/lobbies";
import { codeAttempts } from "@/lib/rate-limit";
import { getCurrentUser, setSessionCookie } from "@/lib/session-cookie";
import { settingsPayload } from "@/lib/socket-messages";

// error est une clé de traduction (Lobbies.errors).
export type JoinFormState = { error?: string; code?: string } | undefined;

// Seuls les inscrits créent une course ; l'invité est envoyé à l'inscription (AUTH-03).
export async function createLobbyAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.isGuest) redirect("/signup?next=/lobbies/new");

  const visibility = z
    .enum(["public", "unlisted", "private"])
    .catch("unlisted")
    .parse(formData.get("visibility"));
  const lobby = await createLobby(user.id, visibility, parseLobbySettings(settingsPayload(formData)));
  redirect(`/lobbies/${lobby.code}`);
}

export async function joinLobbyAction(
  _state: JoinFormState,
  formData: FormData,
): Promise<JoinFormState> {
  const user = await getCurrentUser();
  const code = String(formData.get("code") ?? "");
  // Trop de codes ratés depuis cette IP : on attend la fin de la minute (SALLE-10).
  const ip = await getClientIp();
  if (codeAttempts.isBlocked(ip)) return { error: "tooManyAttempts", code };
  const lobby = code.trim() ? await findOpenLobby(code) : null;
  // Le code seul ne suffit pas pour une course privée (LOB-3).
  const canEnter = lobby && (user ? await canEnterLobby(lobby, user.id) : lobby.visibility !== "private");
  if (!canEnter) {
    codeAttempts.recordFailure(ip);
    return { error: "noOpenLobby", code };
  }
  // Depuis l'accueil sans session : connexion ou invité, puis retour à la course (JOIN-01).
  if (!user) redirect(`/login?next=/lobbies/${lobby.code}`);
  redirect(`/lobbies/${lobby.code}`);
}

// L'hôte d'une course privée ou sur code génère d'un coup le nombre de liens voulu (LOB-3, LOB-7, SALLE-03).
export async function createInvitesAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const lobby = await findOpenLobby(String(formData.get("code") ?? ""));
  const count = z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_INVITES)
    .safeParse(formData.get("count"));
  if (!lobby || lobby.hostId !== user.id || lobby.visibility === "public" || !count.success) {
    return;
  }
  await createInvites(lobby.id, count.data);
  refresh();
}

// Sans session, ouvrir un lien fait jouer en invité.
export async function joinInviteAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  let user = await getCurrentUser();
  if (!user) {
    user = await createGuest();
    const session = await createSession(user.id);
    await setSessionCookie(session.token, session.expiresAt);
  }

  const lobby = await claimInvite(token, user.id, await getClientIp());
  // Lien pris entre-temps : la page d'invitation affiche qu'il n'est plus valide.
  redirect(lobby ? `/lobbies/${lobby.code}` : `/invite/${encodeURIComponent(token)}`);
}
