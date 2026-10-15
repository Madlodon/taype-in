"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import type { ExplorerLobby, LobbiesMessage } from "@/lib/socket-messages";

type Props = {
  language?: ExplorerLobby["textLanguage"];
  complexity?: ExplorerLobby["textComplexity"];
  canCreate: boolean;
};

const COMPLEXITIES = ["easy", "medium", "hard"] as const;

// Explorateur des courses publiques : la liste arrive par le socket et se met à jour
// sans recharger ; les filtres de langue et de complexité sont dans l'URL (?lang=, ?complexity=) (JOIN-02).
export function LobbyExplorer({ language, complexity, canCreate }: Props) {
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

  const shown = lobbies?.filter(
    (lobby) =>
      (!language || lobby.textLanguage === language) &&
      (!complexity || lobby.textComplexity === complexity),
  );

  // Change un filtre en gardant l'autre ; une valeur vide le retire.
  function setFilter(name: "lang" | "complexity", value: string) {
    const filters = { lang: language ?? "", complexity: complexity ?? "", [name]: value };
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    const query = params.toString();
    router.replace(query ? `/lobbies?${query}` : "/lobbies");
  }

  return (
    <section className="panel">
      <div className="panel-top">
        <h2>{t("publicRaces")}</h2>
        {shown && <span className="badge">{d("openRooms", { count: shown.length })}</span>}
      </div>
      <label className="explorer-filter">
        {t("textLanguage")}
        <select value={language ?? ""} onChange={(event) => setFilter("lang", event.target.value)}>
          <option value="">{t("allLanguages")}</option>
          <option value="fr">{t("languages.fr")}</option>
          <option value="en">{t("languages.en")}</option>
        </select>
      </label>
      <label className="explorer-filter">
        {t("complexity")}
        <select value={complexity ?? ""} onChange={(event) => setFilter("complexity", event.target.value)}>
          <option value="">{t("allLanguages")}</option>
          {COMPLEXITIES.map((level) => (
            <option key={level} value={level}>{t(`complexities.${level}`)}</option>
          ))}
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
                  complexity: t(`complexities.${lobby.textComplexity}`),
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
