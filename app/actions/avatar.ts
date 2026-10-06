"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { removeAvatar, saveAvatar } from "@/lib/avatars";
import { getCurrentUser } from "@/lib/session-cookie";

// error est une clé de traduction (Profile.photo.errors).
export type AvatarFormState = { error?: string } | undefined;

// Les invités n'ont pas de profil, donc pas de photo.
async function registeredUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user.isGuest ? null : user;
}

export async function uploadAvatarAction(
  _state: AvatarFormState,
  formData: FormData,
): Promise<AvatarFormState> {
  const user = await registeredUser();
  if (!user) return { error: "guest" };
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "missing" };

  const { error } = await saveAvatar(user.id, file);
  if (error) return { error };
  refresh();
  return undefined;
}

export async function removeAvatarAction(): Promise<void> {
  const user = await registeredUser();
  if (!user) return;
  await removeAvatar(user.id);
  refresh();
  return undefined;
}
