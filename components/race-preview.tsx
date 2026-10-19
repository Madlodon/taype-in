"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Arena } from "@/components/arena";
import { BotBadge } from "@/components/bot-badge";
import { KeyboardNote } from "@/components/keyboard-note";
import { BOT_LEVELS, MAX_BOTS, botKey, createBotEngine, type Bot, type BotLevel } from "@/lib/bots";
import type { Stadium } from "@/lib/garage-items";
import { EMPTY_TYPING } from "@/lib/typing";

type TrainingBot = Bot & { id: string };

export function RacePreview({ stadium }: { stadium?: Stadium } = {}) {
  const t = useTranslations("Race");
  const tLobby = useTranslations("LobbyRoom");
  const prompt = t("prompt");
  const [boosts, setBoosts] = useState<Record<string, number>>({});
  const [typed, setTyped] = useState("");
  const [startedAt, setStartedAt] = useState<number>();
  const [elapsed, setElapsed] = useState(0);
  const [attempts, setAttempts] = useState({ total: 0, correct: 0 });
  // Bots d'entraînement (CONF-10) : rien n'est envoyé au serveur ni enregistré.
  const [bots, setBots] = useState<TrainingBot[]>([]);
  const [botTyped, setBotTyped] = useState<Record<string, number>>({});
  const input = useRef<HTMLTextAreaElement>(null);
  let correctLength = 0;
  while (correctLength < typed.length && typed[correctLength] === prompt[correctLength]) correctLength++;
  const complete = typed === prompt;
  const progress = correctLength / prompt.length;
  const accuracy = attempts.total ? Math.round(attempts.correct / attempts.total * 100) : 100;
  const wpm = elapsed > 0 ? Math.round(correctLength / 5 / (elapsed / 60000)) : 0;
  const started = startedAt !== undefined;
  const botName = (bot: Bot) => tLobby("botName", { level: tLobby(`botLevels.${bot.level}`), number: bot.number });

  // Les bots partent à la première frappe du joueur, avec le même moteur que dans les salons (BOT-01).
  useEffect(() => {
    if (!started) return;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    for (const bot of bots) {
      const engine = createBotEngine(bot.level, Math.floor(Math.random() * 2 ** 32));
      let typing = EMPTY_TYPING;
      const drive = () => {
        const key = botKey(engine, typing, prompt, "blocking");
        const timer = setTimeout(() => {
          timers.delete(timer);
          const moved = key.typing.typed.length > typing.typed.length;
          typing = key.typing;
          setBotTyped(previous => ({ ...previous, [bot.id]: typing.typed.length }));
          if (moved) setBoosts(previous => ({ ...previous, [bot.id]: performance.now() }));
          if (typing.typed.length < prompt.length) drive();
        }, key.delayMs);
        timers.add(timer);
      };
      drive();
    }
    return () => timers.forEach(clearTimeout);
  }, [started, bots, prompt]);

  function restart() {
    setBoosts({});
    setBotTyped({});
    setTyped(""); setStartedAt(undefined); setElapsed(0); setAttempts({ total: 0, correct: 0 });
    input.current?.focus();
  }

  function addBot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const level = new FormData(event.currentTarget).get("level") as BotLevel;
    // Numéro suivant parmi les bots de ce niveau : « Bot Expert 2 ».
    const number = Math.max(0, ...bots.filter(bot => bot.level === level).map(bot => bot.number)) + 1;
    setBots(previous => previous.length >= MAX_BOTS ? previous : [...previous, { id: `bot-${level}-${number}`, level, number }]);
  }

  function update(value: string) {
    const now = Date.now();
    if (startedAt === undefined && value) setStartedAt(now);
    setElapsed(startedAt === undefined ? 0 : now - startedAt);
    // Count new input, including replacements, but never count backspace as an attempt.
    let common = 0;
    while (common < typed.length && common < value.length && typed[common] === value[common]) common++;
    const added = value.slice(common);
    const matches = [...added].filter((character, index) => character === prompt[common + index]).length;
    if (matches > 0) setBoosts(previous => ({ ...previous, preview: performance.now() }));
    setAttempts(previous => ({ total: previous.total + added.length, correct: previous.correct + matches }));
    setTyped(value);
  }

  const racers = [
    { id: "preview", name: "", progress, you: true, bot: undefined as Bot | undefined },
    ...bots.map(bot => ({ id: bot.id, name: botName(bot), progress: (botTyped[bot.id] ?? 0) / prompt.length, you: false, bot: bot as Bot | undefined })),
  ];
  const arena = <Arena cars={racers} stadium={stadium} boosts={boosts} />;

  return <>
    <dl className="race-stats phone-hidden">
      <div>
        <dt>{t("progress")}</dt>
        <dd>{Math.round(progress * 100)}<span className="text-sm text-muted"> %</span>
        </dd>
      </div>
      <div>
        <dt>{t("accuracy")}</dt>
        <dd>{accuracy}<span className="text-sm text-muted"> %</span>
        </dd>
      </div>
      <div>
        <dt>{t("speed")}</dt>
        <dd>{wpm}</dd>
      </div>
    </dl>
    <div className="race-arena">
      {bots.length === 0 ? arena : <div className="race-board">
        {arena}
        <div className="ranking-panel">
          <ol aria-label={tLobby("ranking")} className="ranking">
            {[...racers].sort((a, b) => b.progress - a.progress).map(racer => <li key={racer.id} className={racer.you ? "ranking-you" : undefined}>
              <span className="avatar" aria-hidden="true" />
              <span>
                {racer.you ? t("you") : racer.name}
                {racer.bot && <BotBadge />}
              </span>
              <span className="ranking-stats">{tLobby("percent", { value: Math.round(racer.progress * 100) })}</span>
            </li>)}
          </ol>
        </div>
      </div>}
      <div className="race-track" role="progressbar" aria-label={t("track")} aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
    <KeyboardNote />
    {!started && <section className="panel phone-hidden">
      <h2 className="text-xl font-semibold">{t("bots", { count: bots.length, max: MAX_BOTS })}</h2>
      {bots.length > 0 && <ul aria-label={t("botsList")} className="participants">
        {bots.map(bot => <li key={bot.id}>
          {botName(bot)}
          <BotBadge />
          <button type="button" className="participant-remove" aria-label={`${tLobby("removeBot")} ${botName(bot)}`} onClick={() => setBots(previous => previous.filter(other => other.id !== bot.id))}>
            {tLobby("removeBot")}
          </button>
        </li>)}
      </ul>}
      <form className="bot-form" onSubmit={addBot}>
        <label className="field">
          {tLobby("botLevel")}
          <select name="level">
            {BOT_LEVELS.map(level => <option key={level} value={level}>{tLobby(`botLevels.${level}`)}</option>)}
          </select>
        </label>
        <button type="submit" className="btn btn-secondary" disabled={bots.length >= MAX_BOTS}>{tLobby("addBot")}</button>
      </form>
    </section>}
    <section className="panel panel-accent phone-hidden">
      <div className="panel-top">
        <span className="eyebrow">{complete ? t("goal") : typed ? t("typing") : t("ready")}</span>
        <button type="button" className="text-link" onClick={restart}>{t("restart")} ↻</button>
      </div>
      <p className="sr-only">{prompt}</p>
      <p className="typing-text" aria-hidden="true">{[...prompt].map((character, index) => <span key={index} className={index < typed.length ? (character === typed[index] ? "typed-correct" : "typed-wrong") : index === typed.length ? "typing-cursor" : undefined}>{character}</span>)}</p>
      <label htmlFor="race-input" className="field mb-3">{t("label")}</label>
      <textarea ref={input} id="race-input" className="typing-input" value={typed} onChange={event => update(event.target.value)} readOnly={complete} maxLength={prompt.length} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} aria-describedby="typing-help" onPaste={event => event.preventDefault()} onDrop={event => event.preventDefault()} />
      <p id="typing-help" className="form-note">{t("help")}</p>
      <div role="status">{complete && <div className="race-complete">
        <h2>{t("goal")}</h2>
        <p className="description">{t("finished")}</p>
      </div>}</div>
    </section>
  </>;
}
