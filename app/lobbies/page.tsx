import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { JoinLobbyForm } from "@/components/join-lobby-form";
import { LobbyExplorer } from "@/components/lobby-explorer";
import { getCurrentUser } from "@/lib/session-cookie";

export default async function LobbiesPage({ searchParams }: { searchParams: Promise<{ closed?: string; kicked?: string; lang?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/lobbies");
  // Renvoyé ici quand l'hôte ferme sa course (LOB-10) ou nous exclut (SALLE-07).
  const { closed, kicked, lang } = await searchParams;
  // Filtre de langue de l'explorateur (JOIN-02) ; une autre valeur montre toutes les langues.
  const language = lang === "fr" || lang === "en" ? lang : undefined;
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
      {kicked && <p role="status" className="panel panel-accent mb-6">{t("kicked")}</p>}
      <div className="split-layout">
        <LobbyExplorer language={language} canCreate={!user.isGuest} />
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
