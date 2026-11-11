import { useTranslations } from "next-intl";
import {
  CAPACITY_OPTIONS,
  DEFAULT_TIMER_SECONDS,
  MAX_CAPACITY,
  TIMER_OPTIONS,
  type LobbySettings,
} from "@/lib/lobbies";
import { COMPLEXITIES, MAX_CUSTOM_TEXT, MAX_TEXT_LENGTH, TEXT_LENGTHS, TEXT_TARGETS } from "@/lib/texts";

type Props = { settings?: LobbySettings; locale: string };

// Réglages de la course, choisis à la création puis modifiables avant une relance (LOB-9).
// Sans réglages, la langue du texte suit celle de l'interface.
export function LobbySettingsFields({ settings, locale }: Props) {
  const t = useTranslations("NewLobby");
  const visibility = settings?.visibility ?? "public";
  const textLanguage = settings?.textLanguage ?? (locale === "en" ? "en" : "fr");
  const textLength = settings?.textLength ?? 100;
  const customLength = !TEXT_LENGTHS.some((length) => length === textLength);
  const textComplexity = settings?.textComplexity ?? "medium";
  // Un texte de l'hôte remplace la banque : sa source est « custom ».
  const textSource = settings?.customText ? "custom" : (settings?.textType ?? "sentences");
  const errorMode = settings?.errorMode ?? "blocking";
  const noTimer = settings !== undefined && settings.timeLimitSeconds === null;
  // Une ancienne durée hors des choix revient à la valeur par défaut.
  const timerSeconds = TIMER_OPTIONS.find((seconds) => seconds === settings?.timeLimitSeconds)
    ?? DEFAULT_TIMER_SECONDS;
  const capacity = settings?.capacity ?? MAX_CAPACITY;
  return (
    <>
      {/* SALLE-03 : la visibilité se change aussi entre deux courses. */}
      <fieldset>
        <legend className="text-sm font-semibold">{t("visibility")}</legend>
        {(["public", "unlisted", "private"] as const).map((value) => (
          <label key={value} className="radio-option">
            <input type="radio" name="visibility" value={value} defaultChecked={value === visibility} />{t(value)}</label>
        ))}
      </fieldset>
      {/* TXT-4 à TXT-6 : une seule source de texte ; seules ses options sont affichées (CSS :has). */}
      <div className="text-settings form-stack">
        <fieldset>
          <legend className="text-sm font-semibold">{t("textType")}</legend>
          {(["sentences", "words", "custom"] as const).map((source) => (
            <label key={source} className="radio-option">
              <input type="radio" name="textType" value={source} defaultChecked={source === textSource} />
              {t(`textSources.${source}`)}</label>
          ))}
        </fieldset>
        <fieldset data-for="sentences words">
          <legend className="text-sm font-semibold">{t("textLanguage")}</legend>
          <label className="radio-option">
            <input type="radio" name="textLanguage" value="fr" defaultChecked={textLanguage === "fr"} />{t("french")}</label>
          <label className="radio-option">
            <input type="radio" name="textLanguage" value="en" defaultChecked={textLanguage === "en"} />{t("english")}</label>
        </fieldset>
        <fieldset data-for="sentences words">
          <legend className="text-sm font-semibold">{t("textLength")}</legend>
          {TEXT_LENGTHS.map((length) => (
            <label key={length} className="radio-option">
              <input type="radio" name="textLength" value={length} defaultChecked={length === textLength} />
              {t("words", { count: length })}</label>
          ))}
          {/* Le champ du nombre de mots n'apparaît qu'avec « Personnalisée » cochée. */}
          <label className="radio-option custom-length">
            <input type="radio" name="textLength" value="custom" defaultChecked={customLength} />
            <span className="custom-length-body">
              {t("customLength")}
              <span className="field">
                <span aria-hidden="true">{t("customLengthWords", { max: MAX_TEXT_LENGTH })}</span>
                <input type="number" name="textLengthCustom" aria-label={t("customLengthWords", { max: MAX_TEXT_LENGTH })}
                  min={1} max={MAX_TEXT_LENGTH} step={1} defaultValue={textLength} />
              </span>
            </span>
          </label>
        </fieldset>
        <fieldset data-for="sentences">
          <legend className="text-sm font-semibold">{t("complexity")}</legend>
          {COMPLEXITIES.map((complexity) => (
            <label key={complexity} className="radio-option">
              <input type="radio" name="textComplexity" value={complexity} defaultChecked={complexity === textComplexity} />
              {t(`complexities.${complexity}`)}</label>
          ))}
        </fieldset>
        {/* CONF-06 : décocher retire ce contenu du texte tiré. */}
        <fieldset data-for="sentences">
          <legend className="text-sm font-semibold">{t("textContent")}</legend>
          <label className="radio-option">
            <input type="checkbox" name="textPunctuation" defaultChecked={settings?.textPunctuation ?? true} />{t("punctuation")}</label>
          <label className="radio-option">
            <input type="checkbox" name="textNumbers" defaultChecked={settings?.textNumbers ?? true} />{t("numbers")}</label>
          <label className="radio-option">
            <input type="checkbox" name="textCapitals" defaultChecked={settings?.textCapitals ?? true} />{t("capitals")}</label>
          <label className="radio-option">
            <input type="checkbox" name="textAccents" defaultChecked={settings?.textAccents ?? true} />{t("accents")}</label>
        </fieldset>
        <fieldset data-for="words">
          <legend className="text-sm font-semibold">{t("textTargets")}</legend>
          {TEXT_TARGETS.map((target) => (
            <label key={target} className="radio-option">
              <input type="checkbox" name="textTargets" value={target}
                defaultChecked={settings?.textTargets.includes(target)} />{t(`targets.${target}`)}</label>
          ))}
          <div className="field text-letters">
            <label htmlFor="text-letters">{t("textLetters")}</label>
            <input id="text-letters" name="textLetters" defaultValue={settings?.textLetters} maxLength={26}
              autoComplete="off" aria-describedby="text-letters-hint" />
            <span id="text-letters-hint" className="field-hint">{t("textLettersHint")}</span>
          </div>
        </fieldset>
        <label className="field" data-for="custom">
          {t("customText")}
          <textarea name="customText" defaultValue={settings?.customText ?? ""} maxLength={MAX_CUSTOM_TEXT} rows={4} />
        </label>
      </div>
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
      <fieldset>
        <legend className="text-sm font-semibold">{t("bonuses")}</legend>
        <label className="radio-option">
          <input type="checkbox" name="bonusesEnabled" defaultChecked={settings?.bonusesEnabled ?? false} />
          {t("bonusesEnabled")}
        </label>
      </fieldset>
    </>
  );
}
