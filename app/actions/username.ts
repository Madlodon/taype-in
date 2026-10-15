"use server";

import { redirect } from "next/navigation";
import { credentialsSchema } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session-cookie";
import { changeUsername, revertUsername } from "@/lib/username";

// error est une clé de traduction (Auth.errors pour le format, Profile.username.errors sinon).
export type UsernameFormState = { error?: string; username?: string } | undefined;

function profilePath(username: string) {
  return `/profile/${encodeURIComponent(username)}`;
}

// Les invités n'ont pas de profil, donc pas de nom à changer.
async function registeredUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user.isGuest ? null : user;
}

export async function changeUsernameAction(
  _state: UsernameFormState,
  formData: FormData,
): Promise<UsernameFormState> {
  const user = await registeredUser();
  if (!user) return { error: "guest" };
  const username = String(formData.get("username") ?? "");
  const parsed = credentialsSchema.shape.username.safeParse(username);
  if (!parsed.success) return { error: parsed.error.issues[0].message, username };

  const updated = await changeUsername(user, parsed.data);
  if (typeof updated === "string") return { error: updated, username };
  // L'adresse du profil suit le nouveau nom.
  redirect(profilePath(updated.username));
}

export async function revertUsernameAction(): Promise<void> {
  const user = await registeredUser();
  if (!user) return;
  const updated = await revertUsername(user);
  if (updated) redirect(profilePath(updated.username));
}
