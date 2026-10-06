"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Avatar } from "@/components/avatar";
import { BotBadge } from "@/components/bot-badge";
import { unlockedBetween } from "@/lib/garage-items";
import { rankFromLevel } from "@/lib/ranks";
import type { RaceResult } from "@/lib/socket-messages";
import { levelFromXp } from "@/lib/xp";

type Props = { results: RaceResult[]; userId: string };

const ROMAN = ["I", "II", "III", "IV"];

// Fin de course : podium du top 3 (FIN-1), puis le classement complet avec les statistiques de chacun (FIN-2).
export function RaceResults({ results, userId }: Props) {
  const t = useTranslations("RaceResults");
  const format = useFormatter();
  const decimal = (value: number) => format.number(value, { maximumFractionDigits: 1 });
  const name = (result: RaceResult) =>
    result.id === userId ? `${result.username} ${t("you")}` : result.username;
  // Or II · Div. III ; Supersonic Legend n'a pas de division (#99).
  const rankName = (level: number) => {
    const rank = rankFromLevel(level);
    if (rank.tier === "supersonicLegend") return t("tiers.supersonicLegend");
    return t("rankName", {
      tier: t(`tiers.${rank.tier}`),
      subRank: ROMAN[rank.subRank - 1],
      division: ROMAN[rank.division - 1],
    });
  };
  const mine = results.find((result) => result.id === userId);

  return (
    <section aria-labelledby="results-title" className="mt-5">
      <h2 id="results-title" className="text-xl font-semibold">
        {t("title")}
      </h2>
      {mine && mine.xp !== null && <XpReward xp={mine.xp} xpGained={mine.xpGained} />}
      <ol aria-label={t("podium")} className="podium">
        {results.slice(0, 3).map((result) => (
          <li key={result.id}>
            {!result.bot && <Avatar userId={result.id} size={40} />}
            <span className="podium-name">
              {name(result)}
              {result.bot && <BotBadge />}
            </span>
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
              <th scope="col">{t("level")}</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.id} className={result.id === userId ? "ranking-you" : undefined}>
                <td>{result.rank}</td>
                <th scope="row">
                  <span className="player-cell">
                    {!result.bot && <Avatar userId={result.id} size={24} />}
                    {name(result)}
                    {result.bot && <BotBadge />}
                  </span>
                </th>
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
                {/* Un bot n'a pas de rang (BOT-3). */}
                <td>
                  {result.bot ? (
                    "—"
                  ) : (
                    <>
                      {rankName(result.rankLevel)} <RankChange change={result.rankChange} />
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Flèche de la division gagnée ou perdue ; le texte caché la décrit aux lecteurs d'écran.
function RankChange({ change }: { change: number }) {
  const t = useTranslations("RaceResults");
  const [arrow, label, color] =
    change > 0
      ? ["▲", t("rankUp"), "text-correct"]
      : change < 0
        ? ["▼", t("rankDown"), "text-wrong"]
        : ["=", t("rankSame"), "text-muted"];
  return (
    <>
      <span aria-hidden="true" className={color}>
        {arrow}
      </span>
      <span className="sr-only">{label}</span>
    </>
  );
}

// XP gagnée par le joueur, niveau atteint et objets du garage débloqués (#35) ; inscrits seulement.
function XpReward({ xp, xpGained }: { xp: number; xpGained: number }) {
  const t = useTranslations("RaceResults");
  const garage = useTranslations("Garage");
  const format = useFormatter();
  const before = levelFromXp(xp - xpGained);
  const after = levelFromXp(xp);
  const unlocked = unlockedBetween(before, after);
  return (
    <div role="status" className="xp-reward">
      <strong className="xp-gained">{t("xpGained", { value: xpGained })}</strong>
      <span>{after > before ? t("levelUp", { level: after }) : t("currentLevel", { level: after })}</span>
      {unlocked.length > 0 && (
        <span>
          {t("unlocked", {
            items: format.list(unlocked.map(({ category, item }) => garage(`items.${category}.${item}`))),
          })}{" "}
          <Link href="/garage">{t("toGarage")}</Link>
        </span>
      )}
    </div>
  );
}
