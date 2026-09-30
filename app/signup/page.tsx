import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { signUpAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth-form";

export default async function SignUpPage() {
  const t = await getTranslations("Auth");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">{t("signUpTitle")}</h1>
      <AuthForm
        action={signUpAction}
        submitLabel={t("signUpSubmit")}
        passwordAutoComplete="new-password"
      />
      <p className="text-sm">
        {t("noEmailWarning")}
      </p>
      <Link href="/login" className="underline">
        {t("haveAccount")}
      </Link>
    </main>
  );
}
