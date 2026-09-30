import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { JoinLobbyForm } from "@/components/join-lobby-form";
import { listPublicLobbies } from "@/lib/lobbies";
import { getCurrentUser } from "@/lib/session-cookie";

// Page des lobbys : courses publiques, code et création (LOB-4).
export default async function LobbiesPage() {
  if (!(await getCurrentUser())) redirect("/");
  const publicLobbies = await listPublicLobbies();
  const t = await getTranslations("Lobbies");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <Link
        href="/lobbies/new"
        className="rounded bg-foreground px-4 py-2 text-center text-background"
      >
        {t("create")}
      </Link>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">{t("joinByCode")}</h2>
        <JoinLobbyForm />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">{t("publicRaces")}</h2>
        {publicLobbies.length === 0 ? (
          <p>{t("noPublicRaces")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {publicLobbies.map((lobby) => (
              <li key={lobby.code}>
                <Link href={`/lobbies/${lobby.code}`} className="underline">
                  {t("raceOf", { host: lobby.hostName })}
                </Link>{" "}
                ({t("participantCount", { count: lobby.participantCount })})
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
