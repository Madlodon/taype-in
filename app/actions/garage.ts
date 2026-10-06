"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { saveLoadout } from "@/lib/garage";
import { CATEGORIES, loadoutSchema, unlockLevel } from "@/lib/garage-items";
import { getCurrentUser } from "@/lib/session-cookie";
import { levelFromXp } from "@/lib/xp";

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
  // Un objet verrouillé ne s'enregistre pas, même si le formulaire a été contourné (#35).
  const level = levelFromXp(user.xp);
  if (CATEGORIES.some((category) => unlockLevel(category, loadout.data[category]) > level)) {
    return { error: "locked" };
  }
  await saveLoadout(user.id, loadout.data);
  revalidatePath("/", "layout");
  return { saved: true };
}
