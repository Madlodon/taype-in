"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

// username : seulement pour un inscrit, les invités n'ont pas de profil (PROF-2).
export function SiteNav({ username }: { username?: string }) {
  const pathname = usePathname();
  const t = useTranslations("Design");
  const links = [["/", "home"], ["/lobbies", "play"], ["/race", "preview"], ["/garage", "garage"]];
  if (username) links.push([`/profile/${username}`, "myProfile"]);
  return <nav className="site-nav" aria-label={t("navigation")}>
    {links.map(([href, label]) => (
      <Link key={href} href={href} aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined}>{t(label)}</Link>
    ))}
  </nav>;
}
