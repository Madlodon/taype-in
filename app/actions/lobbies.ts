"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createLobby, findOpenLobby } from "@/lib/lobbies";
import { getCurrentUser } from "@/lib/session-cookie";

// error est une clé de traduction (Lobbies.errors).
export type JoinFormState = { error?: string; code?: string } | undefined;

// Tout utilisateur connecté, invité compris, peut créer une course (LOB-5).
export async function createLobbyAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const visibility = z
    .enum(["public", "unlisted"])
    .catch("unlisted")
    .parse(formData.get("visibility"));
  const lobby = await createLobby(user.id, visibility);
  redirect(`/lobbies/${lobby.code}`);
}

export async function joinLobbyAction(
  _state: JoinFormState,
  formData: FormData,
): Promise<JoinFormState> {
  const code = String(formData.get("code") ?? "");
  const lobby = code.trim() ? await findOpenLobby(code) : null;
  if (!lobby) {
    return { error: "noOpenLobby", code };
  }
  redirect(`/lobbies/${lobby.code}`);
}
