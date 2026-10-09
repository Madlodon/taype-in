"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import type { ExplorerLobby, LobbiesMessage } from "@/lib/socket-messages";

type Props = { language?: ExplorerLobby["textLanguage"]; canCreate: boolean };

// Explorateur des courses publiques : la liste arrive par le socket et se met à jour
// sans recharger ; le filtre de langue est dans l'URL (?lang=) (JOIN-02).
export function LobbyExplorer({ language, canCreate }: Props) {
  const t = useTranslations("Lobbies");
  const d = useTranslations("Design");
  const router = useRouter();
  // undefined tant que la première liste n'est pas arrivée.
  const [lobbies, setLobbies] = useState<ExplorerLobby[]>();

  useEffect(() => {
    const socket = io();
    socket.on("lobbies:list", (message: LobbiesMessage) => setLobbies(message.lobbies));
    // À chaque connexion : après une reconnexion, le serveur a oublié qu'on regardait.
    socket.on("connect", () => socket.emit("lobbies:watch"));
    return () => {
      socket.disconnect();
    };
  }, []);

  const shown = lobbies?.filter((lobby) => !language || lobby.textLanguage === language);

  return (
    <section className="panel">
      <div className="panel-top">
        <h2>{t("publicRaces")}</h2>
        {shown && <span className="badge">{d("openRooms", { count: shown.length })}</span>}
      </div>
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
