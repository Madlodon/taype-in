"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { buildHeatmap, heatLevel, KEYBOARD_ROWS } from "@/lib/heatmap";
import type { RaceResult } from "@/lib/socket-messages";

type Props = { results: RaceResult[]; userId: string };

const WHOLE_RACE = "all";

// Fin de course : clavier coloré selon les fautes par touche, d'un joueur ou de toute la course (FIN-3).
// Par défaut, celui du joueur s'il a couru.
export function KeyboardHeatmap({ results, userId }: Props) {
  const t = useTranslations("KeyboardHeatmap");
  const [selected, setSelected] = useState(
    results.some((result) => result.id === userId) ? userId : WHOLE_RACE,
  );
  const shown = selected === WHOLE_RACE ? results : results.filter((result) => result.id === selected);
  const heatmap = buildHeatmap(shown.map((result) => result.keyErrors));

  const key = (character: string, errors = 0) => (
    <li
      key={character}
      className={`heat-key heat-${heatLevel(errors, heatmap.max)}${character === " " ? " heat-space" : ""}`}
    >
      <kbd>{character === " " ? t("space") : character}</kbd>
      {errors > 0 && (
        <>
          <span aria-hidden="true">{errors}</span>
          <span className="sr-only">{t("errors", { count: errors })}</span>
        </>
      )}
    </li>
  );

  return (
    <section aria-labelledby="heatmap-title" className="mt-5">
      <h2 id="heatmap-title" className="text-xl font-semibold">
        {t("title")}
      </h2>
      <label className="heatmap-select">
        {t("show")}
        <select value={selected} onChange={(event) => setSelected(event.target.value)}>
          <option value={WHOLE_RACE}>{t("wholeRace")}</option>
          {results.map((result) => (
            <option key={result.id} value={result.id}>
              {result.username}
            </option>
          ))}
        </select>
      </label>
      {heatmap.max === 0 && <p className="description mt-3">{t("noErrors")}</p>}
      <div className="heatmap">
        {KEYBOARD_ROWS.map((row) => (
          <ul key={row} className="heat-row">
            {[...row].map((character) => key(character, heatmap.keys[character]))}
          </ul>
        ))}
        <ul className="heat-row">{key(" ", heatmap.keys[" "])}</ul>
      </div>
      {Object.keys(heatmap.extras).length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold">{t("extras")}</h3>
          <ul className="heat-row heat-extras">
            {Object.entries(heatmap.extras)
              .sort(([, a], [, b]) => b - a)
              .map(([character, errors]) => key(character, errors))}
          </ul>
        </>
      )}
    </section>
  );
}
