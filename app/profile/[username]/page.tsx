import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { removeAvatarAction, uploadAvatarAction } from "@/app/actions/avatar";
import { changeUsernameAction, revertUsernameAction } from "@/app/actions/username";
import { Avatar } from "@/components/avatar";
import { AvatarForm } from "@/components/avatar-form";
import { UsernameForm } from "@/components/username-form";
import { ProgressionChart } from "@/components/progression-chart";
import { getAvatarVersion, MAX_AVATAR_BYTES } from "@/lib/avatars";
import {
  computeStats,
  findProfileUser,
  listRaceHistory,
  paginateHistory,
  progressionPoints,
  textLabel,
} from "@/lib/profile";
import { getCurrentUser } from "@/lib/session-cookie";
import { findRenamedUser, nextRenameAt, revertUntil } from "@/lib/username";
import { levelProgress } from "@/lib/xp";

// Page publique : visiteurs, invités et propriétaire voient les mêmes données (PROF-2, PROF-3).
export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { username } = await params;
  const profile = await findProfileUser(username);
  if (!profile) {
    // Un nom quitté il y a moins de 30 jours mène encore au profil (#67).
    const renamed = await findRenamedUser(username);
    if (renamed) redirect(`/profile/${encodeURIComponent(renamed.username)}`);
    notFound();
  }
  const isOwner = (await getCurrentUser())?.id === profile.id;
  const history = await listRaceHistory(profile.id);
  const avatarVersion = await getAvatarVersion(profile.id);
  const stats = computeStats(history);
  const { entries, page, pageCount } = paginateHistory(history, Number((await searchParams).page ?? 1));
  const pageHref = (target: number) => `/profile/${encodeURIComponent(profile.username)}?page=${target}`;
  const progression = progressionPoints(history);
  const level = levelProgress(profile.xp);
  const t = await getTranslations("Profile");
  const format = await getFormatter();
  const wpm = (value: number | null) => (value === null ? "—" : Math.round(value));
  const percent = (value: number | null) =>
    value === null ? "—" : t("percent", { value: Math.round(value) });
  const chartDate = (date: Date) => format.dateTime(date, { day: "numeric", month: "short" });
  const longDate = (date: Date | null) => date && format.dateTime(date, { dateStyle: "long" });

  return (
    <main id="main" className="page-shell">
      <div className="section-heading">
        <div className="profile-identity">
          <Avatar userId={profile.id} version={avatarVersion} size={96} />
          <div>
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1 className="page-title">{profile.username}</h1>
            {/* Les invités ne gagnent pas d'XP (#35). */}
            {!profile.isGuest && (
              <div className="level-progress">
                <span className="badge">{t("level", { level: level.level })}</span>
                <progress value={level.current} max={level.needed} aria-label={t("levelProgress")} />
                <span className="description">
                  {t("xpToNext", { current: level.current, needed: level.needed })}
                </span>
              </div>
            )}
          </div>
        </div>
        {isOwner && <span className="badge">{t("you")}</span>}
      </div>
      {isOwner && (
        <AvatarForm
          upload={uploadAvatarAction}
          remove={removeAvatarAction}
          hasPhoto={avatarVersion !== null}
          maxBytes={MAX_AVATAR_BYTES}
        />
      )}
      {isOwner && (
        <UsernameForm
          change={changeUsernameAction}
          revert={revertUsernameAction}
          username={profile.username}
          nextChange={longDate(nextRenameAt(profile))}
          previousUsername={profile.previousUsername}
          reservedUntil={longDate(revertUntil(profile))}
        />
      )}
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
        <div>
          <dt>{t("wins")}</dt>
          <dd>{stats.wins}</dd>
        </div>
      </dl>
      <section className="panel progression" aria-labelledby="progression-title">
        <h2 id="progression-title">{t("progression")}</h2>
        {progression.length === 0 ? (
          <p className="description mt-5">{t("noProgression")}</p>
        ) : (
          <>
            <p className="description mt-2">{t("progressionHint", { count: progression.length })}</p>
            <div className="progression-charts">
              <ProgressionChart
                title={t("wpm")}
                color="var(--primary)"
                points={progression.map((point) => ({
                  date: chartDate(point.date),
                  value: Math.round(point.wpm),
                  display: String(Math.round(point.wpm)),
                }))}
              />
              <ProgressionChart
                title={t("accuracy")}
                color="var(--accent)"
                max={100}
                points={progression.map((point) => ({
                  date: chartDate(point.date),
                  value: Math.round(point.accuracy),
                  display: percent(point.accuracy),
                }))}
              />
            </div>
          </>
        )}
      </section>
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
                  {entries.map((entry) => (
                    <tr key={entry.raceId}>
                      <td>{format.dateTime(entry.date, { dateStyle: "medium" })}</td>
                      {/* Rouvre les résultats complets de la course (HIST-02). */}
                      <th scope="row">
                        <Link href={`/races/${entry.raceId}`}>{textLabel(entry.textTitle, entry.content)}</Link>
                      </th>
                      <td>{entry.rank}</td>
                      <td>{Math.round(entry.wpm)}</td>
                      <td>{percent(entry.accuracy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pageCount > 1 && (
            <nav aria-label={t("pagination")} className="history-pagination">
              {page > 1 && <Link href={pageHref(page - 1)}>{t("previous")}</Link>}
              <span>{t("pageOf", { page, count: pageCount })}</span>
              {page < pageCount && <Link href={pageHref(page + 1)}>{t("next")}</Link>}
            </nav>
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
