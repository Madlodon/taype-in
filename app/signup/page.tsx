import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { signUpAction } from "@/app/actions/auth";
import { Arena } from "@/components/arena";
import { AuthForm } from "@/components/auth-form";
import { OAuthButtons } from "@/components/oauth-buttons";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const t = await getTranslations("Auth");
  const d = await getTranslations("Design");

  return (
    <main id="main" className="page-shell auth-layout">
      <section className="auth-story">
        <p className="eyebrow">{d("heroTag")}</p>
        <h2>{d("authHeadline")}</h2>
        <p className="description">{d("authDescription")}</p>
        <Arena />
      </section>
      <section className="panel panel-accent auth-card">
        <p className="eyebrow">{d("newDriver")}</p>
        <h1 className="page-title">{t("signUpTitle")}</h1>
        <p className="description">{d("signUpDescription")}</p>
        <AuthForm action={signUpAction} submitLabel={t("signUpSubmit")} passwordAutoComplete="new-password" next={next} />
        <OAuthButtons next={next} />
        <p className="form-note">{t("noEmailWarning")}</p>
        <div className="auth-switch">
          <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="text-link">{t("haveAccount")}</Link>
        </div>
      </section>
    </main>
  );
}
