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
  type RacePositionsMessage,
  type RaceResult,
  type RaceStartedMessage,
  type RaceShotMessage,
  type RaceGoalMessage,
  type RaceBoostMessage,
} from "@/lib/socket-messages";
import { selectShown } from "@/lib/track";
import { Arena } from "@/components/arena";
import { RaceResults } from "@/components/race-results";
import { RaceTyping } from "@/components/race-typing";
import type { RemovedWord } from "@/lib/race-goals";
import { EMPTY_TYPING, hasCorrectInput, type Typing } from "@/lib/typing";
import type { Stadium } from "@/lib/garage-items";

type Props = { code: string; hostId: string; isHost: boolean; userId: string; stadium?: Stadium };

function toProgress({ typed, errors, keys, keyErrors }: Typing) {
  return { typed, errors, keys, keyErrors };
}

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
// Les coureurs tapent le texte ; ceux arrivés en cours de route le regardent.
export function LobbyRoom({ code, hostId, isHost, userId, stadium }: Props) {
  const t = useTranslations("LobbyRoom");
  const router = useRouter();
  const socketRef = useRef<Socket>(null);
  const [participants, setParticipants] = useState<ParticipantsMessage["participants"]>([]);
  const [error, setError] = useState<string>();
  const [countdown, setCountdown] = useState<number>();
  const [race, setRace] = useState<RaceStartedMessage>();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [endReason, setEndReason] = useState<RaceEndedMessage["reason"]>();
  const [results, setResults] = useState<RaceResult[]>([]);
  const [positions, setPositions] = useState<RacePositionsMessage["positions"]>([]);
  // Ta propre position, sans attendre le serveur : ta voiture suit chaque frappe.
  const [myPosition, setMyPosition] = useState<number>();
  const [gaveUp, setGaveUp] = useState(false);
  // Dernière saisie envoyée : renvoyée au retour de la connexion, au cas où des frappes se sont perdues (CRS-6).
  const typingRef = useRef<Typing>(null);
  const [resumed, setResumed] = useState<Typing>();
  const [removed, setRemoved] = useState<RemovedWord[]>([]);
  const [boosts, setBoosts] = useState<Record<string, number>>({});
  const [shots, setShots] = useState<Record<string, RaceShotMessage & { receivedAt: number }>>({});
  const [goalWord, setGoalWord] = useState<string>();
  const [finished, setFinished] = useState(false);

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
      setRemoved(message.mine?.removed ?? []);
      setSecondsLeft(message.secondsLeft);
      if (message.mine?.gaveUp) setGaveUp(true);
      // Retour après un rechargement : on reprend la saisie gardée par le serveur.
      // Après une simple coupure, la saisie locale est plus récente : on la garde.
      if (message.mine && !typingRef.current) {
        typingRef.current = { ...message.mine, blocked: false };
        setResumed(typingRef.current);
        setMyPosition(message.mine.typed.length);
        setFinished(message.mine.typed.length === message.content.length);
      }
    });
    socket.on("race:boost", (message: RaceBoostMessage) => {
      setBoosts(previous => ({ ...previous, [message.id]: performance.now() }));
    });
    socket.on("race:shot", (message: RaceShotMessage) => {
      setShots(previous => ({ ...previous, [message.id]: { ...message, receivedAt: performance.now() } }));
    });
    socket.on("race:goal", (message: RaceGoalMessage) => {
      setRemoved(message.removed);
      setGoalWord(message.word);
    });
    socket.on("race:positions", (message: RacePositionsMessage) => setPositions(message.positions));
    socket.on("race:ended", (message: RaceEndedMessage) => {
      setBoosts({});
      setEndReason(message.reason);
      setResults(message.results);
    });
    // Socket.IO se reconnecte seul après une coupure ; il abandonne seulement si le serveur refuse (ex. non connecté).
    socket.on("connect_error", (err) => {
      if (!socket.active) setError(err.message);
    });
    // À chaque connexion, y compris après une coupure, on rentre dans la salle.
    socket.on("connect", () => {
      socket.emit("lobby:join", { code }, (ack: Ack) => {
        if (!ack.ok) setError(ack.error);
        else if (typingRef.current) socket.emit("race:progress", toProgress(typingRef.current));
      });
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

  // Chaque frappe est envoyée : le serveur sait qui a fini et si quelqu'un tape encore (CRS-5),
  // et garde la saisie pour une reprise après une coupure (CRS-6).
  function progress(typing: Typing) {
    if (race && hasCorrectInput(typingRef.current ?? EMPTY_TYPING, typing, race.content, removed)) {
      setBoosts(previous => ({ ...previous, [userId]: performance.now() }));
    }
    typingRef.current = typing;
    setMyPosition(typing.typed.length);
    setFinished(typing.typed.length === race?.content.length);
    socketRef.current?.emit("race:progress", toProgress(typing));
  }

  function giveUp() {
    if (!window.confirm(t("confirmGiveUp"))) return;
    socketRef.current?.emit("race:giveUp", (ack: Ack) => {
      if (ack.ok) setGaveUp(true);
      else setError(ack.error);
    });
  }

  function close() {
    if (!window.confirm(t("confirmClose"))) return;
    socketRef.current?.emit("lobby:close", (ack: Ack) => {
      if (!ack.ok) setError(ack.error);
    });
  }

  // Pendant et après la course : le top 10 et tes voisins, sur la piste et dans le classement (CRS-2).
  const shown = race ? selectShown(positions, userId) : [];
  const percent = (position: number) => Math.round((position / race!.content.length) * 100);
  const track =
    shown.length === 0 ? (
      <Arena progress={0} stadium={stadium} />
    ) : (
      <div className="race-board">
        <Arena
          stadium={stadium}
          shots={shots}
          boosts={boosts}
          cars={shown.map((entry) => ({
            id: entry.id,
            name: entry.username,
            progress:
              (entry.id === userId ? (myPosition ?? entry.position) : entry.position) /
              race!.content.length,
            you: entry.id === userId,
          }))}
        />
        <ol aria-label={t("ranking")} className="ranking">
          {shown.map((entry, index) => (
            <li
              key={entry.id}
              value={entry.rank}
              className={[
                entry.id === userId && "ranking-you",
                index > 0 && entry.rank !== shown[index - 1].rank + 1 && "ranking-gap",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {entry.username}
              {entry.id === userId && ` ${t("you")}`}
              <span>{t("percent", { value: percent(entry.position) })}</span>
            </li>
          ))}
        </ol>
      </div>
    );

  // Une erreur de transport n'a pas de clé de traduction : son message est affiché tel quel.
  if (error) {
    return (
      <>
        {track}
        <p role="alert" className="form-error">
          {t.has(`errors.${error}`) ? t(`errors.${error}`) : error}
        </p>
      </>
    );
  }

  const timeLeft = secondsLeft !== null && !endReason && (
    <p role="timer" className="text-xl font-semibold mt-5">
      {t("timeLeft", { time: formatTime(secondsLeft) })}
    </p>
  );

  // Pendant la course, le coureur ne voit que le texte à taper, le temps restant et « Abandonner » (CRS-7, CRS-8).
  if (race?.racerIds.includes(userId) && !gaveUp && !endReason) {
    return (
      <>
        {track}
        <section className="panel panel-accent">
          <RaceTyping
            content={race.content}
            errorMode={race.errorMode}
            initial={resumed}
            removed={removed}
            onProgress={progress}
          />
          {goalWord && <p role="status" className="form-note">{t("goalRemoved", { word: goalWord })}</p>}
          {timeLeft}
          {!finished && (
            <button type="button" className="btn btn-secondary btn-lg mt-5" onClick={giveUp}>
              {t("giveUp")}
            </button>
          )}
        </section>
      </>
    );
  }

  return (
    <>
      {track}
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
        {timeLeft}
        {endReason && (
          <p role="status" className="text-xl font-semibold mt-5">
            {t(`ended.${endReason}`)}
          </p>
        )}
        {endReason && <RaceResults results={results} userId={userId} />}
        {race && (
          <>
            <h2 className="text-xl font-semibold mt-5">{t("raceText")}</h2>
            <p className="typing-text">{race.content}</p>
            {!endReason && <p className="form-note">{t(gaveUp ? "gaveUp" : "spectating")}</p>}
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
    </>
  );
}
