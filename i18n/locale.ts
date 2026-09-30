// Langues de l'interface (UI-1) et choix de la langue d'une requête.
export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

// Cookie posé par le sélecteur de langue.
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return locales.includes(value as Locale);
}

// Le cookie l'emporte ; sinon la première langue connue du navigateur, sinon le français.
export function resolveLocale(
  cookieValue: string | undefined,
  acceptLanguage: string | null,
): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  for (const entry of acceptLanguage?.split(",") ?? []) {
    const language = entry.split(";")[0].trim().split("-")[0].toLowerCase();
    if (isLocale(language)) return language;
  }
  return defaultLocale;
}
