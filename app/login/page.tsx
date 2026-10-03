import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { guestAction, logInAction } from "@/app/actions/auth";
import { Arena } from "@/components/arena";
import { AuthForm } from "@/components/auth-form";

export default async function LogInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const t = await getTranslations("Auth");
  const d = await getTranslations("Design");
  const home = await getTranslations("Home");

  return (
    <main id="main" className="page-shell auth-layout">
      <section className="auth-story">
        <p className="eyebrow">{d("heroTag")}</p>
        <h2>{d("authHeadline")}</h2>
        <p className="description">{d("authDescription")}</p>
        <Arena />
      </section>
      <section className="panel panel-accent auth-card">
        <p className="eyebrow">{d("welcomeBack")}</p>
        <h1 className="page-title">{t("logInTitle")}</h1>
        <p className="description">{d("logInDescription")}</p>
        {next && <p role="status" className="panel panel-accent mb-6">{t("signInToContinue")}</p>}
        <AuthForm action={logInAction} submitLabel={t("logInSubmit")} passwordAutoComplete="current-password" next={next} />

        {next && <form action={guestAction} className="mt-3">
          <input type="hidden" name="next" value={next} />
          <button className="btn btn-secondary w-full" type="submit">{home("playAsGuest")}</button>
        </form>}

        <div className="auth-switch">
          <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="text-link">{t("createAccount")}</Link>
        </div>
      </section>
    </main>
  );
}
