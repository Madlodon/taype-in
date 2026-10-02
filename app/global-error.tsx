"use client";

import { useSyncExternalStore } from "react";
import { Geist, JetBrains_Mono, Russo_One } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { LOCALE_COOKIE, defaultLocale, resolveLocale } from "@/i18n/locale";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import ErrorPage from "./error";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const jetBrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });
const russoOne = Russo_One({ variable: "--font-russo-one", weight: "400", subsets: ["latin"] });

// Cette page remplace le layout racine : la langue et le thème sont lus dans le navigateur.
const subscribe = () => () => {};

function browserLocale() {
  const cookie = document.cookie.split("; ").find((entry) => entry.startsWith(`${LOCALE_COOKIE}=`));
  return resolveLocale(cookie?.split("=")[1], navigator.languages.join(","));
}

// next-themes garde le choix sous la clé « theme » ; « system » suit le système.
function browserIsDark() {
  const theme = localStorage.getItem("theme");
  if (theme === "dark" || theme === "light") return theme === "dark";
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const locale = useSyncExternalStore(subscribe, browserLocale, () => defaultLocale);
  const dark = useSyncExternalStore(subscribe, browserIsDark, () => false);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${jetBrainsMono.variable} ${russoOne.variable} h-full antialiased${dark ? " dark" : ""}`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : fr}>
          <ErrorPage error={error} retry={retry} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
