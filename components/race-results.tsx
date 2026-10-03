"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { RaceResult } from "@/lib/socket-messages";

type Props = { results: RaceResult[]; userId: string };

// Fin de course : podium du top 3 (FIN-1), puis le classement complet avec les statistiques de chacun (FIN-2).
export function RaceResults({ results, userId }: Props) {
  const t = useTranslations("RaceResults");
  const format = useFormatter();
  const decimal = (value: number) => format.number(value, { maximumFractionDigits: 1 });
  const name = (result: RaceResult) =>
    result.id === userId ? `${result.username} ${t("you")}` : result.username;

  return (
    <section aria-labelledby="results-title" className="mt-5">
      <h2 id="results-title" className="text-xl font-semibold">
        {t("title")}
      </h2>
      <ol aria-label={t("podium")} className="podium">
        {results.slice(0, 3).map((result) => (
          <li key={result.id}>
            <span className="podium-name">{name(result)}</span>
            <span>{t("wpmValue", { value: Math.round(result.wpm) })}</span>
            <span className="podium-step">{result.rank}</span>
          </li>
        ))}
      </ol>
      <div className="results-scroll">
        <table className="results-table">
          <caption>{t("ranking")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("rank")}</th>
              <th scope="col">{t("player")}</th>
              <th scope="col">{t("wpm")}</th>
              <th scope="col">{t("accuracy")}</th>
              <th scope="col">{t("time")}</th>
              <th scope="col">{t("errors")}</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.id} className={result.id === userId ? "ranking-you" : undefined}>
                <td>{result.rank}</td>
                <th scope="row">{name(result)}</th>
                <td>{Math.round(result.wpm)}</td>
                <td>{t("percent", { value: Math.round(result.accuracy) })}</td>
                <td>
                  {result.finished
                    ? t("seconds", { value: decimal(result.durationMs / 1000) })
                    : t("notFinished")}
                  {/* Mode tolérant : +1 s par faute, compté dans le classement (Q-7). */}
                  {result.finished &&
                    result.penaltyMs > 0 &&
                    ` ${t("penalty", { value: decimal(result.penaltyMs / 1000) })}`}
                </td>
                <td>{result.errors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
