import { useTranslations } from "next-intl";
import { DEFAULT_TIMER_MINUTES, MAX_TIMER_MINUTES, type LobbySettings } from "@/lib/lobbies";
import { TEXT_LENGTHS } from "@/lib/texts";

type Props = { settings?: LobbySettings; locale: string };

// Réglages de la course, choisis à la création puis modifiables avant une relance (LOB-9).
// Sans réglages, la langue du texte suit celle de l'interface.
export function LobbySettingsFields({ settings, locale }: Props) {
  const t = useTranslations("NewLobby");
  const textLanguage = settings?.textLanguage ?? (locale === "en" ? "en" : "fr");
  const textLength = settings?.textLength ?? 100;
  const errorMode = settings?.errorMode ?? "blocking";
  const noTimer = settings !== undefined && settings.timeLimitSeconds === null;
  const timerMinutes = settings?.timeLimitSeconds
    ? Math.round(settings.timeLimitSeconds / 60)
    : DEFAULT_TIMER_MINUTES;
  return (
    <>
      <fieldset>
        <legend className="text-sm font-semibold">{t("textLanguage")}</legend>
        <label className="radio-option">
          <input type="radio" name="textLanguage" value="fr" defaultChecked={textLanguage === "fr"} />{t("french")}</label>
        <label className="radio-option">
          <input type="radio" name="textLanguage" value="en" defaultChecked={textLanguage === "en"} />{t("english")}</label>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">{t("textLength")}</legend>
        {TEXT_LENGTHS.map((length) => (
          <label key={length} className="radio-option">
            <input type="radio" name="textLength" value={length} defaultChecked={length === textLength} />
            {t("words", { count: length })}</label>
        ))}
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">{t("errorMode")}</legend>
        <label className="radio-option">
          <input type="radio" name="errorMode" value="blocking" defaultChecked={errorMode === "blocking"} />{t("blocking")}</label>
        <label className="radio-option">
          <input type="radio" name="errorMode" value="tolerant" defaultChecked={errorMode === "tolerant"} />{t("tolerant")}</label>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">{t("timer")}</legend>
        <label className="field">
          {t("timerMinutes", { max: MAX_TIMER_MINUTES })}
          <input name="timerMinutes" type="number" min={1} max={MAX_TIMER_MINUTES} defaultValue={timerMinutes} required />
        </label>
        <label className="radio-option">
          <input type="checkbox" name="noTimer" defaultChecked={noTimer} />{t("noTimer")}</label>
      </fieldset>
    </>
  );
}
