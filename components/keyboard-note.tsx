import { useTranslations } from "next-intl";

// Sur téléphone, la zone de saisie est remplacée par ce message (DES-06) : voir .phone-only dans globals.css.
export function KeyboardNote() {
  const t = useTranslations("Race");
  return (
    <section role="note" className="panel panel-accent phone-only">
      <h2>{t("keyboardTitle")}</h2>
      <p className="description">{t("keyboardNote")}</p>
    </section>
  );
}
