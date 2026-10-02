"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { Ack, ParticipantsMessage } from "@/lib/socket-messages";

type Props = { code: string; hostId: string; isHost: boolean };

// Salle d'attente : la liste des participants suit les arrivées et départs.
export function LobbyRoom({ code, hostId, isHost }: Props) {
  const t = useTranslations("LobbyRoom");
  const router = useRouter();
  const socketRef = useRef<Socket>(null);
  const [participants, setParticipants] = useState<ParticipantsMessage["participants"]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    socket.on("lobby:participants", (message: ParticipantsMessage) =>
      setParticipants(message.participants),
    );
    // Lobby fermé par l'hôte : tout le monde retourne à la liste avec un message (LOB-10).
    socket.on("lobby:closed", () => router.replace("/lobbies?closed=1"));
    socket.on("connect_error", (err) => setError(err.message));
    socket.emit("lobby:join", { code }, (ack: Ack) => {
      if (!ack.ok) setError(ack.error);
    });
    return () => {
      socket.disconnect();
    };
  }, [code, router]);

  function close() {
    if (!window.confirm(t("confirmClose"))) return;
    socketRef.current?.emit("lobby:close", (ack: Ack) => {
      if (!ack.ok) setError(ack.error);
    });
  }

  // Une erreur de transport n'a pas de clé de traduction : son message est affiché tel quel.
  if (error) {
    return (
      <p role="alert" className="form-error">
        {t.has(`errors.${error}`) ? t(`errors.${error}`) : error}
      </p>
    );
  }

  return (
    <section className="panel">
      <h2 className="text-xl font-semibold">
        {t("participants", { count: participants.length })}
      </h2>
      <ul aria-label={t("participantsList")} className="participants">
        {participants.map((participant) => (
          <li key={participant.id}>
            {participant.username}
            {participant.id === hostId && ` ${t("host")}`}
          </li>
        ))}
      </ul>
      {isHost && (
        <button type="button" className="btn btn-secondary mt-5" onClick={close}>
          {t("close")}
        </button>
      )}
    </section>
  );
}
