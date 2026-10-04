import { getTranslations } from "next-intl/server";
import { RacePreview } from "@/components/race-preview";
import { getCurrentUser } from "@/lib/session-cookie";
import { DEFAULT_LOADOUT, loadoutSchema } from "@/lib/garage-items";

export default async function RacePage() {
  const t = await getTranslations("Race");
  const user = await getCurrentUser();
  const stadium = loadoutSchema.shape.stadium.catch(DEFAULT_LOADOUT.stadium).parse(user?.stadium);
  return <main id="main" className="page-shell race-layout">
    <div className="section-heading">
      <div>
        <p className="eyebrow">{t("tag")}</p>
        <h1 className="page-title">{t("title")}</h1>
        <p className="description">{t("description")}</p>
      </div>
    </div>
    <RacePreview key={t("prompt")} stadium={stadium} />
  </main>;
}
