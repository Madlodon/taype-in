"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createGuest, createSession } from "@/lib/auth";
import {
  canEnterLobby,
  claimInvite,
  createInvites,
  createLobby,
  DEFAULT_TIMER_MINUTES,
  findOpenLobby,
  MAX_INVITES,
  MAX_TIMER_MINUTES,
} from "@/lib/lobbies";
import { getCurrentUser, setSessionCookie } from "@/lib/session-cookie";
import { TEXT_LENGTHS } from "@/lib/texts";

// error est une clé de traduction (Lobbies.errors).
export type JoinFormState = { error?: string; code?: string } | undefined;

// Tout utilisateur connecté, invité compris, peut créer une course (LOB-5).
export async function createLobbyAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const visibility = z
    .enum(["public", "unlisted", "private"])
    .catch("unlisted")
    .parse(formData.get("visibility"));
  // Langue du texte indépendante de celle de l'interface (TXT-1, TXT-2).
  const textLanguage = z.enum(["fr", "en"]).catch("fr").parse(formData.get("textLanguage"));
  const textLength = z.coerce
    .number()
    .pipe(z.union(TEXT_LENGTHS.map((length) => z.literal(length))))
    .catch(100)
    .parse(formData.get("textLength"));
  // Durée en minutes, ou aucune minuterie (CRS-4).
  const timerMinutes = z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_TIMER_MINUTES)
    .catch(DEFAULT_TIMER_MINUTES)
    .parse(formData.get("timerMinutes"));
  const timeLimitSeconds = formData.get("noTimer") ? null : timerMinutes * 60;
  const lobby = await createLobby(user.id, visibility, {
    textLanguage,
    textLength,
    timeLimitSeconds,
  });
  redirect(`/lobbies/${lobby.code}`);
}

export async function joinLobbyAction(
  _state: JoinFormState,
  formData: FormData,
): Promise<JoinFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const code = String(formData.get("code") ?? "");
  const lobby = code.trim() ? await findOpenLobby(code) : null;
  // Le code seul ne suffit pas pour une course privée (LOB-3).
  if (!lobby || !(await canEnterLobby(lobby, user.id))) {
    return { error: "noOpenLobby", code };
  }
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

// Sans session, ouvrir un lien fait jouer en invité.
export async function joinInviteAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  let user = await getCurrentUser();
  if (!user) {
    user = await createGuest();
    const session = await createSession(user.id);
    await setSessionCookie(session.token, session.expiresAt);
  }

  const lobby = await claimInvite(token, user.id);
  // Lien pris entre-temps : la page d'invitation affiche qu'il n'est plus valide.
  redirect(lobby ? `/lobbies/${lobby.code}` : `/invite/${encodeURIComponent(token)}`);
}
