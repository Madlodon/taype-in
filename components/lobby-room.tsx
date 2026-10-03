"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  MIN_RACERS,
  type Ack,
  type CountdownMessage,
  type ParticipantsMessage,
  type RaceStartedMessage,
} from "@/lib/socket-messages";

type Props = { code: string; hostId: string; isHost: boolean; userId: string };

// Salle d'attente : la liste des participants suit les arrivées et départs ;
// l'hôte lance la course, tous voient le même compte à rebours puis le même texte (CRS-1).
export function LobbyRoom({ code, hostId, isHost, userId }: Props) {
  const t = useTranslations("LobbyRoom");
  const router = useRouter();
  const socketRef = useRef<Socket>(null);
  const [participants, setParticipants] = useState<ParticipantsMessage["participants"]>([]);
  const [error, setError] = useState<string>();
  const [countdown, setCountdown] = useState<number>();
  const [race, setRace] = useState<RaceStartedMessage>();

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    socket.on("lobby:participants", (message: ParticipantsMessage) =>
      setParticipants(message.participants),
    );
    // Lobby fermé par l'hôte : tout le monde retourne à la liste avec un message (LOB-10).
    socket.on("lobby:closed", () => router.replace("/lobbies?closed=1"));
    socket.on("race:countdown", (message: CountdownMessage) => setCountdown(message.seconds));
    socket.on("race:started", (message: RaceStartedMessage) => {
      setCountdown(undefined);
      setRace(message);
    });
    socket.on("connect_error", (err) => setError(err.message));
    socket.emit("lobby:join", { code }, (ack: Ack) => {
      if (!ack.ok) setError(ack.error);
    });
    return () => {
      socket.disconnect();
    };
  }, [code, router]);

  // Décompte local ; le serveur envoie le « Go » au bon moment, on s'arrête donc à 1.
  useEffect(() => {
    if (countdown === undefined || countdown <= 1) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  function start() {
    socketRef.current?.emit("race:start", (ack: Ack) => {
      if (!ack.ok) setError(ack.error);
    });
  }

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
      {countdown !== undefined && (
        <p role="timer" aria-live="assertive" className="countdown">
          {t("countdown", { seconds: countdown })}
        </p>
      )}
      {race && (
        <>
          <h2 className="text-xl font-semibold mt-5">{t("raceText")}</h2>
          <p className="typing-text">{race.content}</p>
          {!race.racerIds.includes(userId) && <p className="form-note">{t("spectating")}</p>}
        </>
      )}
      {isHost && countdown === undefined && !race && (
        <>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={start}
              disabled={participants.length < MIN_RACERS}
            >
              {t("start")}
            </button>
            <button type="button" className="btn btn-secondary" onClick={close}>
              {t("close")}
            </button>
          </div>
          {participants.length < MIN_RACERS && (
            <p className="form-note">{t("needMore", { count: MIN_RACERS })}</p>
          )}
        </>
      )}
    </section>
  );
}
