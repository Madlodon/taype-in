import { notFound, redirect } from "next/navigation";
import { LobbyRoom } from "@/components/lobby-room";
import { findOpenLobby } from "@/lib/lobbies";
import { getCurrentUser } from "@/lib/session-cookie";

export default async function LobbyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  if (!(await getCurrentUser())) redirect("/");
  const lobby = await findOpenLobby((await params).code);
  if (!lobby) notFound();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Salle d&apos;attente</h1>
      <p>
        Code de la course :{" "}
        <strong className="font-mono text-2xl tracking-widest">{lobby.code}</strong>
      </p>
      <LobbyRoom code={lobby.code} hostId={lobby.hostId} />
    </main>
  );
}
