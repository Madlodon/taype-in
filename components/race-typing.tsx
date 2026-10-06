"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { withoutRemoved, restoreRemoved, type RemovedWord } from "@/lib/race-goals";
import { applyInput, EMPTY_TYPING, type ErrorMode, type Typing } from "@/lib/typing";

// onProgress reçoit la saisie après chaque frappe ; initial = saisie reprise après une reconnexion (CRS-6).
type Props = {
  content: string;
  errorMode: ErrorMode;
  initial?: Typing;
  removed?: RemovedWord[];
  onProgress?: (typing: Typing) => void;
};

// Zone de frappe pendant la course : seulement le texte, le champ et les fautes (CRS-8).
// Le caractère fautif est mis en évidence (ERR-2).
export function RaceTyping({ content, errorMode, initial = EMPTY_TYPING, removed = [], onProgress }: Props) {
  const t = useTranslations("RaceTyping");
  const [typing, setTyping] = useState(initial);
  // Pendant une composition (accent circonflexe, tréma…), le champ garde la saisie en cours.
  const [draft, setDraft] = useState<string>();
  const visibleContent = withoutRemoved(content, removed);
  const visibleTyped = withoutRemoved(typing.typed, removed);
  const finished = visibleTyped.length === visibleContent.length;

  function update(value: string) {
    setDraft(undefined);
    const edited = applyInput({ ...typing, typed: visibleTyped }, visibleContent, errorMode, value);
    const next = { ...edited, typed: restoreRemoved(edited.typed, content, removed) };
    setTyping(next);
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
      <p className="typing-text" aria-label={visibleContent}>
        {content.split("").map((character, index) => removed.some(range => index >= range.start && index < range.end) ? null : (
          <span aria-hidden="true" key={index} className={letterClass(index)}>
            {character}
          </span>
        ))}
      </p>
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
      <p role="status" className="form-note">
        {finished ? t("finished", { count: typing.errors }) : t("errors", { count: typing.errors })}
      </p>
    </>
  );
}
