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
  type RaceEndedMessage,
  type RaceStartedMessage,
} from "@/lib/socket-messages";

type Props = { code: string; hostId: string; isHost: boolean; userId: string };

// 125 → « 2:05 », 3725 → « 1:02:05 ».
function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}

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
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [endReason, setEndReason] = useState<RaceEndedMessage["reason"]>();

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
      setSecondsLeft(message.secondsLeft);
    });
    socket.on("race:ended", (message: RaceEndedMessage) => setEndReason(message.reason));
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

  // Minuterie locale ; c'est le serveur qui termine la course (CRS-4).
  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0 || endReason) return;
    const timer = setTimeout(() => setSecondsLeft(secondsLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, endReason]);

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
      {secondsLeft !== null && !endReason && (
        <p role="timer" className="text-xl font-semibold mt-5">
          {t("timeLeft", { time: formatTime(secondsLeft) })}
        </p>
      )}
      {endReason && (
        <p role="status" className="text-xl font-semibold mt-5">
          {t(`ended.${endReason}`)}
        </p>
      )}
      {race && (
        <>
          <h2 className="text-xl font-semibold mt-5">{t("raceText")}</h2>
          <p className="typing-text">{race.content}</p>
          {!race.racerIds.includes(userId) && !endReason && (
            <p className="form-note">{t("spectating")}</p>
          )}
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
      {isHost && endReason && (
        <div className="mt-5">
          <button type="button" className="btn btn-secondary" onClick={close}>
            {t("close")}
          </button>
        </div>
      )}
    </section>
  );
}
