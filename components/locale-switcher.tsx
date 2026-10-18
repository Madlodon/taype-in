import { getLocale, getTranslations } from "next-intl/server";
import { setLocaleAction } from "@/app/actions/locale";
import { locales } from "@/i18n/locale";

// Nom de chaque langue écrit dans cette langue.
const names = { fr: "Français", en: "English" };

export async function LocaleSwitcher() {
  const current = await getLocale();
  const t = await getTranslations("LocaleSwitcher");

  return (
    <form action={setLocaleAction} aria-label={t("label")} className="segmented-control">
      {locales.map((locale) => (
        <button
          key={locale}
          type="submit"
          name="locale"
          value={locale}
          lang={locale}
          aria-pressed={locale === current}
          className="uppercase"
        >
          {/* Le nom lu commence par le code affiché (WCAG 2.5.3). */}
          {locale} <span className="sr-only">{names[locale]}</span>
        </button>
      ))}
    </form>
  );
}
