import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { joinInviteAction } from "@/app/actions/lobbies";
import { Arena } from "@/components/arena";
import { getClientIp } from "@/lib/client-ip";
import { findInviteLobby } from "@/lib/lobbies";
import { getCurrentUser } from "@/lib/session-cookie";

// Lien d'invitation à une course privée (LOB-3). Le lien est pris au clic sur le bouton,
// pas à l'ouverture : un aperçu de lien (messagerie, courriel) ne le gaspille pas.
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getCurrentUser();
  const lobby = await findInviteLobby(token, await getClientIp());
  const t = await getTranslations("InvitePage");
  const d = await getTranslations("Design");
  const next = `/invite/${encodeURIComponent(token)}`;

  return (
    <main id="main" className="page-shell auth-layout">
      <section className="auth-story">
        <p className="eyebrow">{d("preMatch")}</p>
        <h2>{d("roomDescription")}</h2>
        <Arena />
      </section>
      <section className="panel panel-accent auth-card">
        {lobby ? <>
          <h1 className="page-title">{t("title")}</h1>
          <p className="description">{t("description")}</p>
          <form action={joinInviteAction}>
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="btn btn-primary">
              {user ? t("join") : t("joinAsGuest")}<span aria-hidden="true">↗</span>
            </button>
          </form>
          {!user && <div className="auth-switch">
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-link">{t("haveAccount")}</Link>
          </div>}
        </> : <>
          <h1 className="page-title">{t("invalidTitle")}</h1>
          <p role="alert" className="form-error">{t("invalid")}</p>
          <div className="auth-switch">
            <Link href="/" className="text-link">{d("home")}</Link>
          </div>
        </>}
      </section>
    </main>
  );
}
