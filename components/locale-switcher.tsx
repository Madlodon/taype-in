import { getLocale, getTranslations } from "next-intl/server";
import { setLocaleAction } from "@/app/actions/locale";
import { locales } from "@/i18n/locale";

// Nom de chaque langue écrit dans cette langue.
const names = { fr: "Français", en: "English" };

export async function LocaleSwitcher() {
  const current = await getLocale();
  const t = await getTranslations("LocaleSwitcher");

  return (
    <form action={setLocaleAction} aria-label={t("label")} className="flex gap-2 text-sm">
      {locales.map((locale) => (
        <button
          key={locale}
          type="submit"
          name="locale"
          value={locale}
          lang={locale}
          aria-label={names[locale]}
          aria-pressed={locale === current}
          className="uppercase aria-pressed:font-bold aria-[pressed=false]:underline"
        >
          {locale}
        </button>
      ))}
    </form>
  );
}
