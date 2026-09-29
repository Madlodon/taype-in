import Link from "next/link";
import { logInAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth-form";

export default function LogInPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Se connecter</h1>
      <AuthForm
        action={logInAction}
        submitLabel="Se connecter"
        passwordAutoComplete="current-password"
      />
      <Link href="/signup" className="underline">
        Créer un compte
      </Link>
    </main>
  );
}
