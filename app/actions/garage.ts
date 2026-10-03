"use server";

import { redirect } from "next/navigation";
import { saveLoadout } from "@/lib/garage";
import { loadoutSchema } from "@/lib/garage-items";
import { getCurrentUser } from "@/lib/session-cookie";

// error est une clé de traduction (Garage.errors).
export type GarageFormState = { saved?: boolean; error?: string } | undefined;

// Seuls les inscrits gardent leur garage ; un invité peut seulement regarder.
export async function saveLoadoutAction(
  _state: GarageFormState,
  formData: FormData,
): Promise<GarageFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.isGuest) return { error: "guest" };

  const loadout = loadoutSchema.safeParse(Object.fromEntries(formData));
  if (!loadout.success) return { error: "invalid" };
  await saveLoadout(user.id, loadout.data);
  return { saved: true };
}
