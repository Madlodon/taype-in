"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { SessionStats as Stats } from "@/lib/session-stats";

type Props = { load: () => Promise<Stats | null> };

// Courses d'affilée de la session en cours, invités compris (PROF-5).
// Chargées à l'affichage : les résultats de la course qui vient de finir sont déjà enregistrés.
export function SessionStats({ load }: Props) {
  const t = useTranslations("SessionStats");
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    load().then(setStats);
  }, [load]);

  if (!stats || stats.races === 0) return null;
  const wpm = (value: number | null) => (value === null ? "—" : Math.round(value));
  const percent = (value: number | null) =>
    value === null ? "—" : t("percent", { value: Math.round(value) });

  return (
    <section aria-labelledby="session-title" className="mt-5">
      <h2 id="session-title" className="text-xl font-semibold mb-3">
        {t("title", { count: stats.races })}
      </h2>
      <dl className="race-stats">
        <div>
          <dt>{t("averageWpm")}</dt>
          <dd>{wpm(stats.averageWpm)}</dd>
        </div>
        <div>
          <dt>{t("bestWpm")}</dt>
          <dd>{wpm(stats.bestWpm)}</dd>
        </div>
        <div>
          <dt>{t("averageAccuracy")}</dt>
          <dd>{percent(stats.averageAccuracy)}</dd>
        </div>
      </dl>
    </section>
  );
}
