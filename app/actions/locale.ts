"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "@/i18n/locale";

// Garde la langue choisie un an ; la page se réaffiche dans cette langue.
export async function setLocaleAction(formData: FormData) {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "lax",
    path: "/",
  });
}
