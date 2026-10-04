import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { updateLobbySettingsAction } from "@/app/actions/lobbies";
import { findOpenLobby } from "@/lib/lobbies";
import { getCurrentUser } from "@/lib/session-cookie";
import { LobbySettingsFields } from "@/components/lobby-settings-fields";

// Avant de relancer le lobby, l'hôte choisit les réglages de la prochaine course (LOB-9).
export default async function LobbySettingsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/lobbies/${encodeURIComponent(code)}/settings`);
  const lobby = await findOpenLobby(code);
  if (!lobby || lobby.hostId !== user.id) notFound();
  const locale = await getLocale();
  const t = await getTranslations("LobbySettings");
  return (
    <main id="main" className="page-shell">
      <Link href={`/lobbies/${lobby.code}`} className="back-link">← {t("back")}</Link>
      <div className="section-heading">
        <div>
          <h1 className="page-title">{t("title")}</h1>
          <p className="description">{t("description")}</p>
        </div>
      </div>
      <section className="panel panel-accent">
        <form action={updateLobbySettingsAction} className="form-stack">
          <input type="hidden" name="code" value={lobby.code} />
          <LobbySettingsFields settings={lobby} locale={locale} />
          <button type="submit" className="btn btn-primary">{t("submit")}</button>
        </form>
      </section>
    </main>
  );
}
