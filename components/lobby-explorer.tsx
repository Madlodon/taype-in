"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { createLobbyAction } from "@/app/actions/lobbies";
import type { ExplorerLobby, LobbiesMessage, QuickRaceAck } from "@/lib/socket-messages";

type Props = { language?: ExplorerLobby["textLanguage"]; canCreate: boolean };

// Explorateur des courses publiques : la liste arrive par le socket et se met à jour
// sans recharger ; le filtre de langue est dans l'URL (?lang=) (JOIN-02).
// « Course rapide » demande au serveur quel lobby rejoindre (JOIN-03).
export function LobbyExplorer({ language, canCreate }: Props) {
  const t = useTranslations("Lobbies");
  const d = useTranslations("Design");
  const router = useRouter();
  // undefined tant que la première liste n'est pas arrivée.
  const [lobbies, setLobbies] = useState<ExplorerLobby[]>();
  // Vrai quand « Course rapide » n'a trouvé aucun lobby.
  const [noQuickLobby, setNoQuickLobby] = useState(false);
  const socketRef = useRef<Socket>(null);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    socket.on("lobbies:list", (message: LobbiesMessage) => setLobbies(message.lobbies));
    // À chaque connexion : après une reconnexion, le serveur a oublié qu'on regardait.
    socket.on("connect", () => socket.emit("lobbies:watch"));
    return () => {
      socket.disconnect();
    };
  }, []);

  const shown = lobbies?.filter((lobby) => !language || lobby.textLanguage === language);

  async function quickRace() {
    const ack: QuickRaceAck | undefined = await socketRef.current?.emitWithAck("lobbies:quick");
    if (ack?.ok) router.push(`/lobbies/${ack.code}`);
    else setNoQuickLobby(true);
  }

  return (
    <section className="panel">
      <div className="panel-top">
        <h2>{t("publicRaces")}</h2>
        {shown && <span className="badge">{d("openRooms", { count: shown.length })}</span>}
      </div>
      <button type="button" className="btn btn-primary mb-6" onClick={quickRace}>
        {t("quickRace")}
      </button>
      {noQuickLobby && (
        <div role="status" className="empty-state">
          <p>{t("noQuickLobby")}</p>
          {/* Réglages par défaut : le formulaire n'envoie que la visibilité. */}
          {canCreate && (
            <form action={createLobbyAction}>
              <input type="hidden" name="visibility" value="public" />
              <button type="submit" className="text-link">{t("createPublic")} →</button>
            </form>
          )}
        </div>
      )}
      <label className="explorer-filter">
        {t("textLanguage")}
        <select
          value={language ?? ""}
          onChange={(event) =>
            router.replace(event.target.value ? `/lobbies?lang=${event.target.value}` : "/lobbies")
          }
        >
          <option value="">{t("allLanguages")}</option>
          <option value="fr">{t("languages.fr")}</option>
          <option value="en">{t("languages.en")}</option>
        </select>
      </label>
      {!shown ? (
        <p className="description">{t("loading")}</p>
      ) : shown.length === 0 ? (
        <div className="empty-state">
          <span className="empty-ball" aria-hidden="true">⬡</span>
          <p>{t("noPublicRaces")}</p>
          {canCreate && <Link href="/lobbies/new" className="text-link">{d("firstRace")} →</Link>}
        </div>
      ) : (
        <ul className="lobby-list">
          {shown.map((lobby) => (
            <li key={lobby.code}>
              <Link href={`/lobbies/${lobby.code}`}>{t("raceOf", { host: lobby.hostName })}</Link>
              <span>
                {t("lobbyInfo", {
                  count: lobby.participantCount,
                  capacity: lobby.capacity,
                  language: t(`languages.${lobby.textLanguage}`),
                  state: t(`states.${lobby.state}`),
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
