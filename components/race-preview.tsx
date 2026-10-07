"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Arena } from "@/components/arena";
import type { Stadium } from "@/lib/garage-items";

export function RacePreview({ stadium }: { stadium?: Stadium } = {}) {
  const t = useTranslations("Race");
  const prompt = t("prompt");
  const [boosts, setBoosts] = useState<Record<string, number>>({});
  const [typed, setTyped] = useState("");
  const [startedAt, setStartedAt] = useState<number>();
  const [elapsed, setElapsed] = useState(0);
  const [attempts, setAttempts] = useState({ total: 0, correct: 0 });
  const input = useRef<HTMLTextAreaElement>(null);
  let correctLength = 0;
  while (correctLength < typed.length && typed[correctLength] === prompt[correctLength]) correctLength++;
  const complete = typed === prompt;
  const progress = correctLength / prompt.length;
  const accuracy = attempts.total ? Math.round(attempts.correct / attempts.total * 100) : 100;
  const wpm = elapsed > 0 ? Math.round(correctLength / 5 / (elapsed / 60000)) : 0;

  function restart() {
    setBoosts({});
    setTyped(""); setStartedAt(undefined); setElapsed(0); setAttempts({ total: 0, correct: 0 });
    input.current?.focus();
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
    if (matches > 0) setBoosts({ preview: performance.now() });
    setAttempts(previous => ({ total: previous.total + added.length, correct: previous.correct + matches }));
    setTyped(value);
  }

  return <>
    <dl className="race-stats">
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
      <Arena progress={progress} stadium={stadium} boosts={boosts} />
      <div className="race-track" role="progressbar" aria-label={t("track")} aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
    <section className="panel panel-accent">
      <div className="panel-top">
        <span className="eyebrow">{complete ? t("goal") : typed ? t("typing") : t("ready")}</span>
        <button type="button" className="text-link" onClick={restart}>{t("restart")} ↻</button>
      </div>
      <p className="typing-text" aria-label={prompt}>{[...prompt].map((character, index) => <span aria-hidden="true" key={index} className={index < typed.length ? (character === typed[index] ? "typed-correct" : "typed-wrong") : index === typed.length ? "typing-cursor" : undefined}>{character}</span>)}</p>
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
