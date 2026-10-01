import { getTranslations } from "next-intl/server";
import { RacePreview } from "@/components/race-preview";

export default async function RacePage() {
  const t = await getTranslations("Race");
  return <main id="main" className="page-shell race-layout">
    <div className="section-heading">
      <div>
        <p className="eyebrow">{t("tag")}</p>
        <h1 className="page-title">{t("title")}</h1>
        <p className="description">{t("description")}</p>
      </div>
    </div>
    <RacePreview key={t("prompt")} />
  </main>;
}
