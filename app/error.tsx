"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Arena } from "@/components/arena";

// Les limites d'erreur de Next doivent être des composants client.
export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("ErrorPages");
  const d = useTranslations("Design");

  return (
    <main id="main" className="page-shell auth-layout">
      <section className="auth-story">
        <p className="eyebrow">{d("heroTag")}</p>
        <h2>{d("authHeadline")}</h2>
        <Arena />
      </section>
      <section className="panel panel-accent auth-card">
        <p className="eyebrow">{t("serverErrorTag")}</p>
        <h1 className="page-title">{t("serverErrorTitle")}</h1>
        <p className="description">{t("serverErrorDescription")}</p>
        <div className="hero-actions">
          <button type="button" className="btn btn-primary" onClick={() => retry()}>{t("tryAgain")}<span aria-hidden="true">↻</span>
          </button>
          <Link href="/" className="btn btn-secondary">{t("backHome")}</Link>
        </div>
      </section>
    </main>
  );
}
