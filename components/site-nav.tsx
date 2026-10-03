"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export function SiteNav() {
  const pathname = usePathname();
  const t = useTranslations("Design");
  return <nav className="site-nav" aria-label={t("navigation")}>
    {[["/", "home"], ["/lobbies", "play"], ["/race", "preview"], ["/garage", "garage"]].map(([href, label]) => (
      <Link key={href} href={href} aria-current={(href === "/" ? pathname === href : pathname.startsWith(href)) ? "page" : undefined}>{t(label)}</Link>
    ))}
  </nav>;
}
