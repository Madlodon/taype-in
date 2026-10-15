import { useTranslations } from "next-intl";
import type { SettingsMessage } from "@/lib/socket-messages";

// Réglages de la prochaine course, vus par tous dans la salle d'attente (CONF-12).
// Un texte de l'hôte n'est pas montré avant le « Go ».
export function LobbySettingsSummary({ settings }: { settings: SettingsMessage }) {
  const t = useTranslations("LobbyRoom.settings");
  const n = useTranslations("NewLobby");
  const timer = settings.timeLimitSeconds;
  // Les caractères ciblés ne servent qu'aux mots mélangés de la banque.
  const targets = !settings.customText && settings.textType === "words"
    ? [
        ...settings.textTargets.map((target) => n(`targets.${target}`)),
        ...(settings.textLetters ? [t("letters", { letters: settings.textLetters })] : []),
      ]
    : [];
  return (
    <section aria-labelledby="settings-title" className="mt-5">
      <h3 id="settings-title" className="text-lg font-semibold mb-3">{t("title")}</h3>
      <dl className="lobby-settings">
        <div>
          <dt>{n("textLanguage")}</dt>
          <dd>{n(settings.textLanguage === "fr" ? "french" : "english")}</dd>
        </div>
        <div>
          <dt>{t("text")}</dt>
          <dd>
            {settings.customText
              ? t("custom")
              : `${n("words", { count: settings.textLength })} · ${t(settings.textType)}`}
          </dd>
        </div>
        {targets.length > 0 && (
          <div>
            <dt>{t("targets")}</dt>
            <dd>{targets.join(", ")}</dd>
          </div>
        )}
        <div>
          <dt>{n("errorMode")}</dt>
          <dd>{t(settings.errorMode)}</dd>
        </div>
        <div>
          <dt>{n("timer")}</dt>
          <dd>
            {timer === null
              ? n("noTimer")
              : n("timerOption", { minutes: Math.floor(timer / 60), seconds: timer % 60 })}
          </dd>
        </div>
        <div>
          <dt>{n("capacity")}</dt>
          <dd>{n("participants", { count: settings.capacity })}</dd>
        </div>
      </dl>
    </section>
  );
}
