import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { oauthSignUpAction } from "@/app/actions/auth";
import { Arena } from "@/components/arena";
import { AuthForm } from "@/components/auth-form";
import { decodePending, PENDING_COOKIE, PROVIDER_NAMES } from "@/lib/oauth";

// Nouveau compte Discord ou GitHub : le joueur choisit son nom avant la création (AUTH-2).
export default async function OAuthSignUpPage() {
  const pending = decodePending((await cookies()).get(PENDING_COOKIE)?.value);
  if (!pending) redirect("/login?error=oauthFailed");
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
        <h1 className="page-title">{t("oauthTitle")}</h1>
        <p className="description">{t("oauthDescription", { provider: PROVIDER_NAMES[pending.provider] })}</p>
        <AuthForm action={oauthSignUpAction} submitLabel={t("oauthSubmit")} defaultUsername={pending.username} />
      </section>
    </main>
  );
}
