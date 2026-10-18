"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { withoutRemoved, restoreRemoved, type RemovedWord } from "@/lib/race-goals";
import { SLOW_LETTER_MS } from "@/lib/race-bonuses";
import {
  accuracy,
  applyInput,
  countCorrect,
  EMPTY_TYPING,
  wordsPerMinute,
  type ErrorMode,
  type Typing,
} from "@/lib/typing";

// onProgress reçoit la saisie après chaque frappe ; initial = saisie reprise après une reconnexion (CRS-6).
// startedAt = moment du « Go » (Date.now()), pour le MPM en direct (COURSE-04).
// children s'affiche entre le texte et le champ, là où les yeux restent pendant la frappe.
// Bonus reçus (BON-3) : textClassName floute ou réduit le texte ; slowLetters = lettres qui
// attendent chacune 1 s après la frappe précédente, onSlowLetter appelé à chacune.
type Props = {
  content: string;
  errorMode: ErrorMode;
  initial?: Typing;
  startedAt: number;
  removed?: RemovedWord[];
  textClassName?: string;
  slowLetters?: number;
  onSlowLetter?: () => void;
  onProgress?: (typing: Typing) => void;
  children?: ReactNode;
};

// Lue seulement dans les gestionnaires de frappe, pas pendant le rendu.
function clock() {
  return Date.now();
}

// Zone de frappe pendant la course : seulement le texte, le champ et les fautes (CRS-8).
// Le caractère fautif est mis en évidence (ERR-2).
export function RaceTyping({
  content,
  errorMode,
  initial = EMPTY_TYPING,
  startedAt,
  removed = [],
  textClassName,
  slowLetters = 0,
  onSlowLetter,
  onProgress,
  children,
}: Props) {
  const t = useTranslations("RaceTyping");
  const [typing, setTyping] = useState(initial);
  // Pendant une composition (accent circonflexe, tréma…), le champ garde la saisie en cours.
  const [draft, setDraft] = useState<string>();
  const lastKeyAtRef = useRef(0);
  const visibleContent = withoutRemoved(content, removed);
  const visibleTyped = withoutRemoved(typing.typed, removed);
  const finished = visibleTyped.length === visibleContent.length;
  // Horloge du MPM : avance chaque seconde et à chaque frappe, s'arrête à l'arrivée.
  const [now, setNow] = useState(startedAt);
  const wpm = wordsPerMinute(countCorrect(visibleTyped, visibleContent), now - startedAt);

  useEffect(() => {
    if (finished) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [finished]);

  function update(value: string) {
    setDraft(undefined);
    // Lettre trop tôt pendant le bonus « attente » : refusée, le champ garde l'ancienne saisie.
    if (slowLetters > 0 && value.length > visibleTyped.length) {
      if (clock() - lastKeyAtRef.current < SLOW_LETTER_MS) return;
      onSlowLetter?.();
    }
    lastKeyAtRef.current = clock();
    const edited = applyInput({ ...typing, typed: visibleTyped }, visibleContent, errorMode, value);
    const next = { ...edited, typed: restoreRemoved(edited.typed, content, removed) };
    setTyping(next);
    setNow(() => Date.now());
    onProgress?.(next);
  }

  function letterClass(index: number) {
    if (index < typing.typed.length) {
      return typing.typed[index] === content[index] ? "typed-correct" : "typed-wrong";
    }
    if (index === typing.typed.length) {
      return typing.blocked ? "typing-cursor typed-wrong" : "typing-cursor";
    }
    return undefined;
  }

  return (
    <>
      {/* aria-label est interdit sur un <p> : le texte lu reste dans une copie invisible (A11Y-03). */}
      <p className="sr-only">{visibleContent}</p>
      <p className={textClassName ? `typing-text ${textClassName}` : "typing-text"} aria-hidden="true">
        {content.split("").map((character, index) => removed.some(range => index >= range.start && index < range.end) ? null : (
          <span key={index} className={letterClass(index)}>
            {character}
          </span>
        ))}
      </p>
      {children}
      <label htmlFor="race-typing" className="field mb-3">
        {t("label")}
      </label>
      <textarea
        id="race-typing"
        className="typing-input"
        value={draft ?? visibleTyped}
        onChange={(event) =>
          (event.nativeEvent as InputEvent).isComposing
            ? setDraft(event.target.value)
            : update(event.target.value)
        }
        onCompositionEnd={(event) => update(event.currentTarget.value)}
        // Saisie reprise après une reconnexion : on continue à la fin, pas au début (CRS-6).
        onFocus={(event) => {
          const end = event.currentTarget.value.length;
          event.currentTarget.setSelectionRange(end, end);
        }}
        readOnly={finished}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-describedby="race-typing-help"
        onPaste={(event) => event.preventDefault()}
        onDrop={(event) => event.preventDefault()}
      />
      <p id="race-typing-help" className="form-note">
        {t(errorMode)}
      </p>
      <p className="form-note">
        {t("live", {
          wpm: Math.round(wpm),
          accuracy: Math.round(accuracy(typing.keys, typing.errors)),
        })}
      </p>
      <p role="status" className="form-note">
        {finished ? t("finished", { count: typing.errors }) : t("errors", { count: typing.errors })}
      </p>
    </>
  );
}
