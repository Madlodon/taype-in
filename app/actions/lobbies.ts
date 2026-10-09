"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createGuest, createSession } from "@/lib/auth";
import { getClientIp } from "@/lib/client-ip";
import {
  CAPACITY_OPTIONS,
  canEnterLobby,
  claimInvite,
  createInvites,
  createLobby,
  DEFAULT_TIMER_SECONDS,
  findOpenLobby,
  MAX_CAPACITY,
  MAX_INVITES,
  updateLobbySettings,
  TIMER_OPTIONS,
  type LobbySettings,
} from "@/lib/lobbies";
import { getCurrentUser, setSessionCookie } from "@/lib/session-cookie";
import { TEXT_LENGTHS } from "@/lib/texts";

// error est une clé de traduction (Lobbies.errors).
export type JoinFormState = { error?: string; code?: string } | undefined;

// Réglages communs à la création et à la relance d'un lobby.
function parseSettings(formData: FormData): LobbySettings {
  // Langue du texte indépendante de celle de l'interface (TXT-1, TXT-2).
  const textLanguage = z.enum(["fr", "en"]).catch("fr").parse(formData.get("textLanguage"));
  const textLength = z.coerce
    .number()
    .pipe(z.union(TEXT_LENGTHS.map((length) => z.literal(length))))
    .catch(100)
    .parse(formData.get("textLength"));
  // Bloquant : la saisie s'arrête jusqu'au bon caractère ; tolérant : on continue (ERR-1).
  const errorMode = z.enum(["blocking", "tolerant"]).catch("blocking").parse(formData.get("errorMode"));
  // Durée parmi les choix proposés, ou aucune minuterie (CONF-01).
  const timerSeconds = z.coerce
    .number()
    .pipe(z.union(TIMER_OPTIONS.map((seconds) => z.literal(seconds))))
    .catch(DEFAULT_TIMER_SECONDS)
    .parse(formData.get("timerSeconds"));
  const timeLimitSeconds = formData.get("noTimer") ? null : timerSeconds;
  // Capacité de 2 à 30 participants, 30 hors de ces bornes (SALLE-05).
  const capacity = z.coerce
    .number()
    .pipe(z.union(CAPACITY_OPTIONS.map((count) => z.literal(count))))
    .catch(MAX_CAPACITY)
    .parse(formData.get("capacity"));
  return { textLanguage, textLength, errorMode, timeLimitSeconds, capacity };
}

// Seuls les inscrits créent une course ; l'invité est envoyé à l'inscription (AUTH-03).
export async function createLobbyAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.isGuest) redirect("/signup?next=/lobbies/new");

  const visibility = z
    .enum(["public", "unlisted", "private"])
    .catch("unlisted")
    .parse(formData.get("visibility"));
  const lobby = await createLobby(user.id, visibility, parseSettings(formData));
  redirect(`/lobbies/${lobby.code}`);
}

export async function joinLobbyAction(
  _state: JoinFormState,
  formData: FormData,
): Promise<JoinFormState> {
  const user = await getCurrentUser();
  const code = String(formData.get("code") ?? "");
  const lobby = code.trim() ? await findOpenLobby(code) : null;
  // Le code seul ne suffit pas pour une course privée (LOB-3).
  const canEnter = lobby && (user ? await canEnterLobby(lobby, user.id) : lobby.visibility !== "private");
  if (!canEnter) return { error: "noOpenLobby", code };
  // Depuis l'accueil sans session : connexion ou invité, puis retour à la course (JOIN-01).
  if (!user) redirect(`/login?next=/lobbies/${lobby.code}`);
  redirect(`/lobbies/${lobby.code}`);
}

// L'hôte génère d'un coup le nombre de liens voulu (LOB-3, LOB-7).
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
  if (!lobby || lobby.hostId !== user.id || lobby.visibility !== "private" || !count.success) {
    return;
  }
  await createInvites(lobby.id, count.data);
  refresh();
}

// L'hôte change les réglages avant de relancer le même lobby, puis y retourne (LOB-9).
export async function updateLobbySettingsAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const lobby = await findOpenLobby(String(formData.get("code") ?? ""));
  if (!lobby || lobby.hostId !== user.id) redirect("/lobbies");
  await updateLobbySettings(lobby.id, parseSettings(formData));
  redirect(`/lobbies/${lobby.code}`);
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
