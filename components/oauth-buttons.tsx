import { getTranslations } from "next-intl/server";
import { enabledProviders, PROVIDER_NAMES } from "@/lib/oauth";

// Liens vers la connexion Discord et GitHub (AUTH-2) ; rien si aucun fournisseur n'a de clés.
export async function OAuthButtons({ next }: { next?: string }) {
  const providers = enabledProviders();
  if (providers.length === 0) return null;
  const t = await getTranslations("Auth");

  return (
    <div className="mt-3 flex flex-col gap-3">
      <p className="form-note text-center">{t("orDivider")}</p>
      {providers.map((provider) => (
        // Lien ordinaire : la route redirige vers le fournisseur, rien à précharger.
        <a
          key={provider}
          href={next ? `/auth/${provider}?next=${encodeURIComponent(next)}` : `/auth/${provider}`}
          className="btn btn-secondary w-full"
        >
          {t("continueWith", { provider: PROVIDER_NAMES[provider] })}
        </a>
      ))}
    </div>
  );
}
