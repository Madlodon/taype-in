import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Arena } from "@/components/arena";

// Page affichée pour une URL inconnue ou un code de course introuvable.
export default async function NotFound() {
  const t = await getTranslations("ErrorPages");
  const d = await getTranslations("Design");

  return (
    <main id="main" className="page-shell auth-layout">
      <section className="auth-story">
        <p className="eyebrow">{d("heroTag")}</p>
        <h2>{d("authHeadline")}</h2>
        <Arena />
      </section>
      <section className="panel panel-accent auth-card">
        <p className="eyebrow">{t("notFoundTag")}</p>
        <h1 className="page-title">{t("notFoundTitle")}</h1>
        <p className="description">{t("notFoundDescription")}</p>
        <Link href="/" className="btn btn-primary">{t("backHome")}<span aria-hidden="true">↗</span>
        </Link>
      </section>
    </main>
  );
}
