import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { guestAction, logOutAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/session-cookie";
import { Arena } from "@/components/arena";

export default async function Home() {
  const user = await getCurrentUser();
  const t = await getTranslations("Home");
  const d = await getTranslations("Design");
  return (
    <main id="main" className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">{d("heroTag")}</p>
          <h1>{d("heroTitle")}<br />
            <span>{d("heroAccent")}</span>
          </h1>
          <p className="hero-copy">{d("heroDescription")}</p>
          <div className="hero-actions">
            {user ? <Link href="/lobbies" className="btn btn-primary">{t("startRace")}<span aria-hidden="true">↗</span>
            </Link> :
              <form action={guestAction}>
                <button className="btn btn-primary" type="submit">{t("playAsGuest")}<span aria-hidden="true">↗</span>
                </button>
              </form>}
            <Link href="/race" className="btn btn-secondary">{d("tryPreview")}<span aria-hidden="true">→</span>
            </Link>
          </div>
          {user ? <div className="account-line">
            <p>{t.rich("loggedInAs", { username: user.username, strong: chunks => <strong>{chunks}</strong> })}{user.isGuest && ` ${t("guest")}`}</p>
            <form action={logOutAction}>
              <button className="text-link" type="submit">{t("logOut")}</button>
            </form>
          </div> : <div className="account-line flex flex-wrap gap-5">
            <Link className="text-link" href="/signup">{t("signUp")}</Link>
            <Link className="text-link" href="/login">{t("logIn")}</Link>
          </div>}
        </div>
        <div className="hero-visual">
          <span className="badge visual-topline">{d("stadiumLabel")}</span>
          <Arena />
          <div className="visual-label">
            <span>{d("visualCaption")}</span>
            <Link className="text-link" href="/race">{d("explore")} ↗</Link>
          </div>
        </div>
      </section>
      <section className="feature-strip" aria-label={d("howItWorks")}>
        {["type", "boost", "score"].map((key, index) => <div key={key} className="feature">
          <span className="feature-number">0{index + 1}</span>
          <div>
            <h2>{d(`${key}Title`)}</h2>
            <p>{d(`${key}Description`)}</p>
          </div>
        </div>)}
      </section>
    </main>
  );
}
