import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { JoinLobbyForm } from "@/components/join-lobby-form";
import { listPublicLobbies } from "@/lib/lobbies";
import { getCurrentUser } from "@/lib/session-cookie";

export default async function LobbiesPage({ searchParams }: { searchParams: Promise<{ closed?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/lobbies");
  // Renvoyé ici quand l'hôte ferme sa course (LOB-10).
  const { closed } = await searchParams;
  const publicLobbies = await listPublicLobbies();
  const t = await getTranslations("Lobbies");
  const d = await getTranslations("Design");
  return (
    <main id="main" className="page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{d("matchmaking")}</p>
          <h1 className="page-title">{t("title")}</h1>
          <p className="description">{d("lobbiesDescription")}</p>
        </div>
        {/* Les invités ne créent pas de course (AUTH-03). */}
        {user.isGuest ? <Link href="/signup?next=/lobbies/new" className="text-link">{t("signUpToCreate")} →</Link> :
          <Link href="/lobbies/new" className="btn btn-primary">
            <span aria-hidden="true">＋</span>{t("create")}</Link>}
      </div>
      {closed && <p role="status" className="panel panel-accent mb-6">{t("closed")}</p>}
      <div className="split-layout">
        <section className="panel">
          <div className="panel-top">
            <h2>{t("publicRaces")}</h2>
            <span className="badge">{d("openRooms", { count: publicLobbies.length })}</span>
          </div>
          {publicLobbies.length === 0 ? <div className="empty-state">
            <span className="empty-ball" aria-hidden="true">⬡</span>
            <p>{t("noPublicRaces")}</p>
            {!user.isGuest && <Link href="/lobbies/new" className="text-link">{d("firstRace")} →</Link>}
          </div> :
            <ul className="lobby-list">{publicLobbies.map(lobby => <li key={lobby.code}>
              <Link href={`/lobbies/${lobby.code}`}>{t("raceOf", { host: lobby.hostName })}</Link>
              <span>{t("participantCount", { count: lobby.participantCount })}</span>
            </li>)}</ul>}
        </section>
        <aside className="side-stack">
          <section className="panel panel-accent">
            <h2>{t("joinByCode")}</h2>
            <p className="description mb-6">{d("joinDescription")}</p>
            <JoinLobbyForm />
          </section>
          <section className="panel">
            <p className="eyebrow mb-4">{d("warmUp")}</p>
            <p className="description mb-5">{d("warmUpDescription")}</p>
            <Link href="/race" className="text-link">{d("tryPreview")} →</Link>
          </section>
        </aside>
      </div>
    </main>
  );
}
