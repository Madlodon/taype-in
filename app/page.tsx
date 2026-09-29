import Link from "next/link";
import { guestAction, logOutAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/session-cookie";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">taype-in</h1>
      {user ? (
        <>
          <p>
            Connecté en tant que <strong>{user.username}</strong>
            {user.isGuest && " (invité)"}
          </p>
          <form action={logOutAction}>
            <button type="submit" className="underline">
              Se déconnecter
            </button>
          </form>
        </>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <Link href="/signup" className="underline">
            Créer un compte
          </Link>
          <Link href="/login" className="underline">
            Se connecter
          </Link>
          <form action={guestAction}>
            <button
              type="submit"
              className="rounded bg-foreground px-4 py-2 text-background"
            >
              Jouer en invité
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
