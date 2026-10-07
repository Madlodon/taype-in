import { useTranslations } from "next-intl";
import {
  CAPACITY_OPTIONS,
  DEFAULT_TIMER_SECONDS,
  MAX_CAPACITY,
  TIMER_OPTIONS,
  type LobbySettings,
} from "@/lib/lobbies";
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
  // Une ancienne durée hors des choix revient à la valeur par défaut.
  const timerSeconds = TIMER_OPTIONS.find((seconds) => seconds === settings?.timeLimitSeconds)
    ?? DEFAULT_TIMER_SECONDS;
  const capacity = settings?.capacity ?? MAX_CAPACITY;
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
          {t("timerDuration")}
          <select name="timerSeconds" defaultValue={timerSeconds}>
            {TIMER_OPTIONS.map((seconds) => (
              <option key={seconds} value={seconds}>
                {t("timerOption", { minutes: Math.floor(seconds / 60), seconds: seconds % 60 })}
              </option>
            ))}
          </select>
        </label>
        <label className="radio-option">
          <input type="checkbox" name="noTimer" defaultChecked={noTimer} />{t("noTimer")}</label>
      </fieldset>
      <label className="field">
        {t("capacity")}
        <select name="capacity" defaultValue={capacity}>
          {CAPACITY_OPTIONS.map((count) => (
            <option key={count} value={count}>{t("participants", { count })}</option>
          ))}
        </select>
      </label>
    </>
  );
}
