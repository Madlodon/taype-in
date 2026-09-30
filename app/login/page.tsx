import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { logInAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth-form";

export default async function LogInPage() {
  const t = await getTranslations("Auth");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">{t("logInTitle")}</h1>
      <AuthForm
        action={logInAction}
        submitLabel={t("logInSubmit")}
        passwordAutoComplete="current-password"
      />
      <Link href="/signup" className="underline">
        {t("createAccount")}
      </Link>
    </main>
  );
}
