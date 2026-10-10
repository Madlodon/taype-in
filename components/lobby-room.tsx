"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
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
import { detectOvertake, selectShown, type Overtake } from "@/lib/track";
import { BOT_LEVELS, type Bot } from "@/lib/bots";
import { Arena } from "@/components/arena";
import { BotBadge } from "@/components/bot-badge";
import { KeyboardHeatmap } from "@/components/keyboard-heatmap";
import { RaceResults } from "@/components/race-results";
import { RaceTyping } from "@/components/race-typing";
import type { RemovedWord } from "@/lib/race-goals";
import { SessionStats } from "@/components/session-stats";
import type { SessionStats as Stats } from "@/lib/session-stats";
import { EMPTY_TYPING, hasCorrectInput, type Typing } from "@/lib/typing";
import type { Stadium } from "@/lib/garage-items";

type Props = {
  code: string;
  hostId: string;
  userId: string;
  stadium?: Stadium;
  loadSessionStats: () => Promise<Stats | null>;
};

function toProgress({ typed, errors, keys, keyErrors }: Typing) {
  return { typed, errors, keys, keyErrors };
}

// Les bots reçoivent leur nom dans la langue de l'interface : « Bot Débutant 1 » (BOT-3).
function withBotNames<T extends { username: string; bot?: Bot }>(
  entries: T[],
  botName: (bot: Bot) => string,
): T[] {
  return entries.map((entry) => (entry.bot ? { ...entry, username: botName(entry.bot) } : entry));
}

// Au plus 10 messages de progression par seconde (PERF-02).
const PROGRESS_MS = 100;

// Durée d'affichage d'un dépassement (CRS-3).
const OVERTAKE_MS = 2500;

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
export function LobbyRoom({ code, hostId: pageHostId, userId, stadium, loadSessionStats }: Props) {
  const t = useTranslations("LobbyRoom");
  const format = useFormatter();
  const router = useRouter();
  const socketRef = useRef<Socket>(null);
  const [participants, setParticipants] = useState<ParticipantsMessage["participants"]>([]);
  // L'hôte peut changer en cours de route (SALLE-08).
  const [hostId, setHostId] = useState(pageHostId);
  const isHost = hostId === userId;
  const [error, setError] = useState<string>();
  const [countdown, setCountdown] = useState<number>();
  const [race, setRace] = useState<RaceStartedMessage>();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  // Moment du « Go » selon l'horloge locale, pour le MPM en direct (COURSE-04).
  const [startedAt, setStartedAt] = useState(0);
  const [endReason, setEndReason] = useState<RaceEndedMessage["reason"]>();
  const [results, setResults] = useState<RaceResult[]>([]);
  const [positions, setPositions] = useState<RacePositionsMessage["positions"]>([]);
  // Classement précédent, pour repérer qui tu viens de dépasser ou qui t'a dépassé.
  const positionsRef = useRef<RacePositionsMessage["positions"]>([]);
  // `at` relance l'animation quand un nouveau dépassement remplace le précédent.
  const [overtake, setOvertake] = useState<Overtake & { at: number }>();
  // Ta propre position, sans attendre le serveur : ta voiture suit chaque frappe.
  const [myPosition, setMyPosition] = useState<number>();
  const [gaveUp, setGaveUp] = useState(false);
  // Dernière saisie envoyée : renvoyée au retour de la connexion, au cas où des frappes se sont perdues (CRS-6).
  const typingRef = useRef<Typing>(null);
  // Heure du dernier envoi, et envoi différé de la dernière saisie s'il est trop tôt (PERF-02).
  const sentAtRef = useRef(0);
  const pendingRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [resumed, setResumed] = useState<Typing>();
  const [removed, setRemoved] = useState<RemovedWord[]>([]);
  const [boosts, setBoosts] = useState<Record<string, number>>({});
  const [shots, setShots] = useState<Record<string, RaceShotMessage & { receivedAt: number }>>({});
  const [goalWord, setGoalWord] = useState<string>();
  const [finished, setFinished] = useState(false);
  // Lu par les gestionnaires du socket, branchés une seule fois.
  const botNameRef = useRef<(bot: Bot) => string>(null);
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
    botNameRef.current = (bot) =>
      t("botName", { level: t(`botLevels.${bot.level}`), number: bot.number });
  });

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    const named = <T extends { username: string; bot?: Bot }>(entries: T[]) =>
      withBotNames(entries, botNameRef.current!);
    socket.on("lobby:participants", (message: ParticipantsMessage) => {
      setHostId(message.hostId);
      setParticipants(named(message.participants));
    });
    // Lobby fermé par l'hôte : tout le monde retourne à la liste avec un message (LOB-10).
    socket.on("lobby:closed", () => router.replace("/lobbies?closed=1"));
    // Exclu par l'hôte : retour à la liste avec un message (SALLE-07).
    socket.on("lobby:kicked", () => {
      socket.disconnect();
      router.replace("/lobbies?kicked=1");
    });
    // L'hôte relance le lobby : tout le monde revient à la salle d'attente (LOB-9).
    socket.on("lobby:restarted", () => {
      setCountdown(undefined);
      setRace(undefined);
      setSecondsLeft(null);
      setEndReason(undefined);
      setResults([]);
      setPositions([]);
      // Sinon le départ de la prochaine course passerait pour des dépassements.
      positionsRef.current = [];
      setOvertake(undefined);
      setMyPosition(undefined);
      setGaveUp(false);
      typingRef.current = null;
      clearTimeout(pendingRef.current);
      pendingRef.current = undefined;
      setResumed(undefined);
      setFinished(false);
    });
    socket.on("race:countdown", (message: CountdownMessage) => setCountdown(message.seconds));
    socket.on("race:started", (message: RaceStartedMessage) => {
      setCountdown(undefined);
      setRace(message);
      setStartedAt(Date.now() - message.elapsedMs);
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
    socket.on("race:positions", (message: RacePositionsMessage) => {
      const positions = named(message.positions);
      const cue = detectOvertake(positionsRef.current, positions, userId);
      positionsRef.current = positions;
      if (cue) setOvertake({ ...cue, at: Date.now() });
      setPositions(positions);
    });
    socket.on("race:ended", (message: RaceEndedMessage) => {
      setBoosts({});
      setEndReason(message.reason);
      setResults(named(message.results));
    });
    // Socket.IO se reconnecte seul après une coupure ; il abandonne seulement si le serveur refuse (ex. non connecté).
    socket.on("connect_error", (err) => {
      if (!socket.active) setError(err.message);
    });
    // Rejoint un autre lobby depuis un autre onglet : celui-ci n'y est plus (SALLE-06).
    socket.on("lobby:left", () => {
      socket.disconnect();
      setError("leftForOtherLobby");
    });
    // Déjà dans un autre lobby : on propose de le quitter, sinon on revient à la liste (SALLE-06).
    const join = (leave?: boolean) =>
      socket.emit("lobby:join", { code, leave }, (ack: Ack) => {
        if (ack.ok) {
          if (typingRef.current) socket.emit("race:progress", toProgress(typingRef.current));
        } else if (ack.error !== "inOtherLobby") {
          setError(ack.error);
        } else if (window.confirm(tRef.current!("confirmLeaveOther"))) {
          join(true);
        } else {
          router.replace("/lobbies");
        }
      });
    // À chaque connexion, y compris après une coupure, on rentre dans la salle.
    socket.on("connect", () => join());
    // En quittant la page (ex. rechargement), la saisie en attente part tout de suite (CRS-6).
    const flush = () => {
      if (pendingRef.current === undefined) return;
      clearTimeout(pendingRef.current);
      pendingRef.current = undefined;
      socket.emit("race:progress", toProgress(typingRef.current!));
    };
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      socket.disconnect();
    };
  }, [code, router, userId]);

  // Nouvel hôte : la page se recharge côté serveur pour lui montrer le code ou les liens d'invitation.
  useEffect(() => {
    if (hostId !== pageHostId) router.refresh();
  }, [hostId, pageHostId, router]);

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

  useEffect(() => {
    if (!overtake) return;
    const timer = setTimeout(() => setOvertake(undefined), OVERTAKE_MS);
    return () => clearTimeout(timer);
  }, [overtake]);

  // L'hôte court avec les autres ou regarde seulement (LOB-8).
  function start(watch: boolean) {
    socketRef.current?.emit("race:start", { watch }, (ack: Ack) => {
      if (!ack.ok) setError(ack.error);
    });
  }

  // L'hôte ajoute des bots avant le départ ; ils comptent comme participants (BOT-1).
  function addBot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const level = new FormData(event.currentTarget).get("level");
    socketRef.current?.emit("lobby:addBot", { level }, (ack: Ack) => {
      if (!ack.ok) setError(ack.error);
    });
  }

  function removeBot(id: string) {
    socketRef.current?.emit("lobby:removeBot", { id }, (ack: Ack) => {
      if (!ack.ok) setError(ack.error);
    });
  }

  // L'hôte exclut un participant ou un spectateur, à tout moment (SALLE-07).
  function kick(id: string, username: string) {
    if (!window.confirm(t("confirmKick", { username }))) return;
    socketRef.current?.emit("lobby:kick", { id }, (ack: Ack) => {
      if (!ack.ok) setError(ack.error);
    });
  }

  function sendProgress() {
    clearTimeout(pendingRef.current);
    pendingRef.current = undefined;
    sentAtRef.current = Date.now();
    socketRef.current?.emit("race:progress", toProgress(typingRef.current!));
  }

  // La saisie est envoyée au plus toutes les 100 ms : le serveur sait qui a fini et si quelqu'un
  // tape encore (CRS-5), et garde la saisie pour une reprise après une coupure (CRS-6).
  // La fin du texte part aussitôt pour ne pas retarder l'arrivée.
  function progress(typing: Typing) {
    if (race && hasCorrectInput(typingRef.current ?? EMPTY_TYPING, typing, race.content, removed)) {
      setBoosts(previous => ({ ...previous, [userId]: performance.now() }));
    }
    typingRef.current = typing;
    const done = typing.typed.length === race?.content.length;
    setMyPosition(typing.typed.length);
    setFinished(done);
    const wait = sentAtRef.current + PROGRESS_MS - Date.now();
    if (done || wait <= 0) sendProgress();
    else pendingRef.current ??= setTimeout(sendProgress, wait);
  }

  function giveUp() {
    if (!window.confirm(t("confirmGiveUp"))) return;
    socketRef.current?.emit("race:giveUp", (ack: Ack) => {
      if (ack.ok) setGaveUp(true);
      else setError(ack.error);
    });
  }

  // L'hôte choisit ensuite les réglages de la prochaine course (LOB-9).
  function relaunch() {
    socketRef.current?.emit("lobby:restart", (ack: Ack) => {
      if (ack.ok) router.push(`/lobbies/${encodeURIComponent(code)}/settings`);
      else setError(ack.error);
    });
  }

  function close() {
    if (!window.confirm(t("confirmClose"))) return;
    socketRef.current?.emit("lobby:close", (ack: Ack) => {
      if (!ack.ok) setError(ack.error);
    });
  }

  // Un hôte qui regarde ne compte pas parmi les participants (LOB-8).
  const hostWatching = race !== undefined && !race.racerIds.includes(hostId);
  // Pour regarder, l'hôte doit laisser au moins un humain dans la course (COURSE-02).
  const otherHuman = participants.some((participant) => !participant.bot && participant.id !== hostId);
  const participantCount = participants.filter(
    (participant) => !(hostWatching && participant.id === hostId),
  ).length;

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
              {entry.bot && <BotBadge />}
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
            startedAt={startedAt}
            removed={removed}
            onProgress={progress}
          >
            {/* Toujours là, même vide : le champ ne bouge pas quand un dépassement s'affiche. */}
            <p aria-live="polite" className="overtake">
              {overtake && (
                <span key={overtake.at} className={`overtake-${overtake.direction}`}>
                  <span aria-hidden="true">{overtake.direction === "up" ? "▲ " : "▼ "}</span>
                  {t(`overtake.${overtake.direction}`, {
                    names: format.list(overtake.names),
                    count: overtake.names.length,
                    rank: overtake.rank,
                  })}
                </span>
              )}
            </p>
          </RaceTyping>
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
          {t("participants", { count: participantCount })}
        </h2>
        <ul aria-label={t("participantsList")} className="participants">
          {participants.map((participant) => (
            <li key={participant.id}>
              {participant.username}
              {participant.bot && <BotBadge />}
              {participant.id === hostId && ` ${t("host")}`}
              {participant.id === hostId && hostWatching && ` ${t("watching")}`}
              {participant.bot && isHost && countdown === undefined && !race && (
                <button
                  type="button"
                  className="participant-remove"
                  aria-label={`${t("removeBot")} ${participant.username}`}
                  onClick={() => removeBot(participant.id)}
                >
                  {t("removeBot")}
                </button>
              )}
              {!participant.bot && isHost && participant.id !== userId && (
                <button
                  type="button"
                  className="participant-remove"
                  aria-label={`${t("kick")} ${participant.username}`}
                  onClick={() => kick(participant.id, participant.username)}
                >
                  {t("kick")}
                </button>
              )}
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
        {endReason && <KeyboardHeatmap results={results} userId={userId} />}
        {endReason && <SessionStats load={loadSessionStats} />}
        {race && (
          <>
            <h2 className="text-xl font-semibold mt-5">{t("raceText")}</h2>
            <p className="typing-text">{race.content}</p>
            {!endReason && (
              <p className="form-note">
                {t(gaveUp ? "gaveUp" : isHost ? "hostWatching" : "spectating")}
              </p>
            )}
          </>
        )}
        {isHost && countdown === undefined && !race && (
          <>
            <form className="bot-form" onSubmit={addBot}>
              <label className="field">
                {t("botLevel")}
                <select name="level">
                  {BOT_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {t(`botLevels.${level}`)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="btn btn-secondary">
                {t("addBot")}
              </button>
            </form>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => start(false)}
                disabled={participants.length < MIN_RACERS}
              >
                {t("startRacing")}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => start(true)}
                disabled={participants.length - 1 < MIN_RACERS || !otherHuman}
              >
                {t("startWatching")}
              </button>
              <button type="button" className="btn btn-secondary" onClick={close}>
                {t("close")}
              </button>
            </div>
            {participants.length < MIN_RACERS ? (
              <p className="form-note">{t("needMore", { count: MIN_RACERS })}</p>
            ) : (
              participants.length - 1 < MIN_RACERS ? (
                <p className="form-note">{t("needMoreWatching", { count: MIN_RACERS })}</p>
              ) : (
                !otherHuman && <p className="form-note">{t("needHumanWatching")}</p>
              )
            )}
          </>
        )}
        {!isHost && countdown === undefined && !race && (
          <p className="form-note">{t("waitingForHost")}</p>
        )}
        {isHost && endReason && (
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" onClick={relaunch}>
              {t("relaunch")}
            </button>
            <button type="button" className="btn btn-secondary" onClick={close}>
              {t("close")}
            </button>
          </div>
        )}
      </section>
    </>
  );
}
