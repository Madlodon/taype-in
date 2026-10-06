"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/avatar";

type Props = { username?: string; userId?: string; avatarVersion?: number | null };

// username : seulement pour un inscrit, les invités n'ont pas de profil (PROF-2).
// Le lien vers son profil porte sa photo (PROF-1).
export function SiteNav({ username, userId, avatarVersion }: Props) {
  const pathname = usePathname();
  const t = useTranslations("Design");
  const links = [["/", "home"], ["/lobbies", "play"], ["/race", "preview"], ["/garage", "garage"]];
  if (username) links.push([`/profile/${username}`, "myProfile"]);
  return <nav className="site-nav" aria-label={t("navigation")}>
    {links.map(([href, label]) => (
      <Link key={href} href={href} aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined}>
        {label === "myProfile" && userId && <Avatar userId={userId} version={avatarVersion} size={24} />}
        {t(label)}
      </Link>
    ))}
  </nav>;
}
