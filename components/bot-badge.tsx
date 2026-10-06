import { useTranslations } from "next-intl";

// Marque un bot partout où son nom apparaît (BOT-3).
export function BotBadge() {
  const t = useTranslations("LobbyRoom");
  return <span className="badge bot-badge">{t("bot")}</span>;
}
