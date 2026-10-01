"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

const themes = ["light", "dark", "system"] as const;

// Le thème choisi n'est connu que dans le navigateur : rien n'est marqué au rendu serveur.
const subscribe = () => () => {};

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const t = useTranslations("ThemeSwitcher");

  return (
    <div role="group" aria-label={t("label")} className="segmented-control">
      {themes.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => setTheme(name)}
          aria-pressed={mounted && theme === name}
          className="theme-option"
        >
          {t(name)}
        </button>
      ))}
    </div>
  );
}
