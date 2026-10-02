import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { InviteLinks } from "@/components/invite-links";
import { LobbyRoom } from "@/components/lobby-room";
import { Arena } from "@/components/arena";
import { canEnterLobby, findOpenLobby } from "@/lib/lobbies";
import { getCurrentUser } from "@/lib/session-cookie";

export default async function LobbyPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const lobby = await findOpenLobby((await params).code);
  // Une course privée reste introuvable pour qui n'a pas d'invitation (LOB-3).
  if (!lobby || !(await canEnterLobby(lobby, user.id))) notFound();
  // Seul l'hôte invite, par le code ou par des liens (LOB-7).
  const isHost = lobby.hostId === user.id;
  const t = await getTranslations("LobbyRoom");
  const d = await getTranslations("Design");
  return (
    <main id="main" className="page-shell">
      <Link href="/lobbies" className="back-link">← {d("backToRaces")}</Link>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{d("preMatch")}</p>
          <h1 className="page-title">{t("title")}</h1>
          <p className="description">{d("roomDescription")}</p>
        </div>
        <span className="badge">{d("waiting")}</span>
      </div>
      <div className="split-layout">
        <div className="side-stack">
          <Arena progress={0} />
          <LobbyRoom code={lobby.code} hostId={lobby.hostId} isHost={isHost} userId={user.id} />
        </div>
        <aside className="side-stack">
          {isHost && (lobby.visibility === "private" ? <InviteLinks lobby={lobby} /> :
            <section className="panel panel-accent">
              <p className="room-code">{t("code")}<strong>{lobby.code}</strong>
              </p>
              <p className="description">{d("shareCode")}</p>
            </section>)}
          <section className="panel">
            <h2>{d("nextUp")}</h2>
            <p className="description">{d("raceComing")}</p>
            <p className="room-info">{d("previewSeparate")}</p>
            <Link href="/race" className="text-link inline-block mt-5">{d("tryPreview")} →</Link>
          </section>
        </aside>
      </div>
    </main>
  );
}
