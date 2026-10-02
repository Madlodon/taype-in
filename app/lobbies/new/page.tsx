import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { createLobbyAction } from "@/app/actions/lobbies";
import { getCurrentUser } from "@/lib/session-cookie";
import { Arena } from "@/components/arena";

export default async function NewLobbyPage() {
  if (!(await getCurrentUser())) redirect("/");
  const t = await getTranslations("NewLobby");
  const d = await getTranslations("Design");
  return (
    <main id="main" className="page-shell">
      <Link href="/lobbies" className="back-link">← {d("backToRaces")}</Link>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{d("yourArena")}</p>
          <h1 className="page-title">{t("title")}</h1>
          <p className="description">{d("createDescription")}</p>
        </div>
      </div>
      <div className="split-layout">
        <section className="panel panel-accent">
          <form action={createLobbyAction} className="form-stack">
            <fieldset>
              <legend className="text-sm font-semibold">{t("visibility")}</legend>
              <label className="radio-option">
                <input type="radio" name="visibility" value="public" defaultChecked />{t("public")}</label>
              <label className="radio-option">
                <input type="radio" name="visibility" value="unlisted" />{t("unlisted")}</label>
              <label className="radio-option">
                <input type="radio" name="visibility" value="private" />{t("private")}</label>
            </fieldset>
            <button type="submit" className="btn btn-primary">{t("submit")}<span aria-hidden="true">↗</span>
            </button>
          </form>
        </section>
        <aside className="side-stack">
          <Arena />
          <section className="panel">
            <h2>{d("bringFriends")}</h2>
            <p className="description">{d("inviteDescription")}</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
