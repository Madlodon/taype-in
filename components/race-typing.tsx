"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { applyInput, EMPTY_TYPING, type ErrorMode } from "@/lib/typing";

type Props = { content: string; errorMode: ErrorMode };

// Zone de frappe pendant la course : seulement le texte, le champ et les fautes (CRS-8).
// Le caractère fautif est mis en évidence (ERR-2).
export function RaceTyping({ content, errorMode }: Props) {
  const t = useTranslations("RaceTyping");
  const [typing, setTyping] = useState(EMPTY_TYPING);
  // Pendant une composition (accent circonflexe, tréma…), le champ garde la saisie en cours.
  const [draft, setDraft] = useState<string>();
  const finished = typing.typed.length === content.length;

  function update(value: string) {
    setDraft(undefined);
    setTyping((state) => applyInput(state, content, errorMode, value));
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
      <p className="typing-text" aria-label={content}>
        {[...content].map((character, index) => (
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
        value={draft ?? typing.typed}
        onChange={(event) =>
          (event.nativeEvent as InputEvent).isComposing
            ? setDraft(event.target.value)
            : update(event.target.value)
        }
        onCompositionEnd={(event) => update(event.currentTarget.value)}
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
