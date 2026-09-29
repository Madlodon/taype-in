import Link from "next/link";
import { signUpAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth-form";

export default function SignUpPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Créer un compte</h1>
      <AuthForm
        action={signUpAction}
        submitLabel="Créer le compte"
        passwordAutoComplete="new-password"
      />
      <p className="text-sm">
        Aucun courriel : un mot de passe oublié ne peut pas être récupéré.
      </p>
      <Link href="/login" className="underline">
        J&apos;ai déjà un compte
      </Link>
    </main>
  );
}
