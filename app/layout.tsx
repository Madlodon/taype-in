import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Geist, JetBrains_Mono, Russo_One } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { SiteNav } from "@/components/site-nav";
import { getCurrentUser } from "@/lib/session-cookie";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Texte à taper : lisible, accents français compris.
const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

// Titres : style arcade sportif.
const russoOne = Russo_One({
  variable: "--font-russo-one",
  weight: "400",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return { title: "Taype-in", description: t("description") };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("Footer");
  const d = await getTranslations("Design");
  const user = await getCurrentUser();

  return (
    <html
      lang={await getLocale()}
      className={`${geistSans.variable} ${jetBrainsMono.variable} ${russoOne.variable} h-full antialiased`}
      // next-themes ajoute la classe du thème avant l'hydratation.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" disableTransitionOnChange>
          <NextIntlClientProvider>
            <a href="#main" className="skip-link">{d("skip")}</a>
            <header className="site-header">
              {/* « TAYPE- » noir en clair, blanc en sombre. */}
              <Link href="/" className="brand" aria-label="Taype-in">
                <Image src="/taype-in-orange.png" alt="Taype-in" width={1257} height={609} sizes="160px" className="dark:hidden" />
                <Image src="/taype-in-orange-dark.png" alt="Taype-in" width={1257} height={609} sizes="160px" className="hidden dark:block" />
              </Link>
              <SiteNav username={user && !user.isGuest ? user.username : undefined} />
              <div className="header-settings"><ThemeSwitcher /><LocaleSwitcher /></div>
              <Link href="/" className="brand brand-right" aria-label="Taype-in">
                <Image src="/taype-in-blue.png" alt="Taype-in" width={1372} height={666} sizes="160px" className="dark:hidden" />
                <Image src="/taype-in-blue-dark.png" alt="Taype-in" width={1372} height={666} sizes="160px" className="hidden dark:block" />
              </Link>
            </header>
            {children}
            <footer className="site-footer">{t("disclaimer")}</footer>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
