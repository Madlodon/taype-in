import { redirect } from "next/navigation";
import { createLobbyAction } from "@/app/actions/lobbies";
import { getCurrentUser } from "@/lib/session-cookie";

export default async function NewLobbyPage() {
  if (!(await getCurrentUser())) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Créer une course</h1>
      <form action={createLobbyAction} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-medium">Visibilité</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="visibility" value="public" defaultChecked />
            Publique : visible dans la liste des courses
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="visibility" value="unlisted" />
            Non répertoriée : on la rejoint avec le code
          </label>
        </fieldset>
        <button
          type="submit"
          className="rounded bg-foreground px-4 py-2 text-background"
        >
          Créer la course
        </button>
      </form>
    </main>
  );
}
