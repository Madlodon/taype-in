import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { computeStats, findProfileUser, listRaceHistory, type HistoryEntry } from "@/lib/profile";
import { getCurrentUser } from "@/lib/session-cookie";

// Premiers mots d'un texte écrit par l'hôte, qui n'a pas de titre.
function excerpt(content: string): string {
  const words = content.split(/\s+/);
  return words.length > 6 ? `${words.slice(0, 6).join(" ")}…` : content;
}

// Page publique : visiteurs, invités et propriétaire voient les mêmes données (PROF-2, PROF-3).
export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const profile = await findProfileUser((await params).username);
  if (!profile) notFound();
  const isOwner = (await getCurrentUser())?.id === profile.id;
  const history = await listRaceHistory(profile.id);
  const stats = computeStats(history);
  const t = await getTranslations("Profile");
  const format = await getFormatter();
  const wpm = (value: number | null) => (value === null ? "—" : Math.round(value));
  const percent = (value: number | null) =>
    value === null ? "—" : t("percent", { value: Math.round(value) });
  const text = (entry: HistoryEntry) => entry.textTitle ?? excerpt(entry.content);

  return (
    <main id="main" className="page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="page-title">{profile.username}</h1>
        </div>
        {isOwner && <span className="badge">{t("you")}</span>}
      </div>
      <dl className="race-stats" aria-label={t("stats")}>
        <div>
          <dt>{t("bestWpm")}</dt>
          <dd>{wpm(stats.bestWpm)}</dd>
        </div>
        <div>
          <dt>{t("averageWpm")}</dt>
          <dd>{wpm(stats.averageWpm)}</dd>
        </div>
        <div>
          <dt>{t("averageAccuracy")}</dt>
          <dd>{percent(stats.averageAccuracy)}</dd>
        </div>
      </dl>
      <div className="split-layout">
        <section className="panel">
          <h2 id="history-title">{t("history")}</h2>
          {history.length === 0 ? (
            <div className="empty-state">
              <span className="empty-ball" aria-hidden="true">⬡</span>
              <p>{t("noRaces")}</p>
            </div>
          ) : (
            <div className="results-scroll mt-5">
              <table className="results-table" aria-labelledby="history-title">
                <thead>
                  <tr>
                    <th scope="col">{t("date")}</th>
                    <th scope="col">{t("text")}</th>
                    <th scope="col">{t("rank")}</th>
                    <th scope="col">{t("wpm")}</th>
                    <th scope="col">{t("accuracy")}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr key={entry.raceId}>
                      <td>{format.dateTime(entry.date, { dateStyle: "medium" })}</td>
                      <th scope="row">{text(entry)}</th>
                      <td>{entry.rank}</td>
                      <td>{Math.round(entry.wpm)}</td>
                      <td>{percent(entry.accuracy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <aside className="panel">
          <h2 id="hard-keys-title">{t("hardestKeys")}</h2>
          {stats.hardestKeys.length === 0 ? (
            <p className="description mt-5">{t("noHardKeys")}</p>
          ) : (
            <ol className="hard-keys" aria-labelledby="hard-keys-title">
              {stats.hardestKeys.map(({ key, errors }) => (
                <li key={key}>
                  <kbd>{key === " " ? t("space") : key}</kbd>
                  <span>{t("errors", { count: errors })}</span>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </main>
  );
}
