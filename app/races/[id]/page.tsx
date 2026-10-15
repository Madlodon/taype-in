import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { KeyboardHeatmap } from "@/components/keyboard-heatmap";
import { RaceResults } from "@/components/race-results";
import { WpmChart } from "@/components/wpm-chart";
import { textLabel } from "@/lib/profile";
import { findPastRace } from "@/lib/results";
import { getCurrentUser } from "@/lib/session-cookie";

// Résultats complets d'une course de l'historique, ouverts depuis un profil (HIST-02).
// Publique comme les profils ; le rang gagné et l'XP ne sont pas enregistrés, donc pas réaffichés.
export default async function PastRacePage({ params }: { params: Promise<{ id: string }> }) {
  const race = await findPastRace((await params).id);
  if (!race) notFound();
  const userId = (await getCurrentUser())?.id ?? "";
  const t = await getTranslations("PastRace");
  const format = await getFormatter();
  const results = race.results.map((result) => ({ ...result, rankLevel: 0, rankChange: 0, xp: null, xpGained: 0 }));

  return (
    <main id="main" className="page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="page-title">{t("title")}</h1>
          <p className="description">
            {t("summary", {
              text: textLabel(race.textTitle, race.content),
              date: format.dateTime(race.date, { dateStyle: "medium", timeStyle: "short" }),
            })}
          </p>
        </div>
      </div>
      <section className="panel">
        <RaceResults results={results} userId={userId} showLevel={false} />
        <WpmChart results={results} userId={userId} />
        <KeyboardHeatmap results={results} userId={userId} />
      </section>
    </main>
  );
}
