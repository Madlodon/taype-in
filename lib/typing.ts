// Saisie d'un coureur : ce qu'il a tapé et toutes les fautes faites (ERR-1).
import type { RaceStartedMessage } from "./socket-messages.ts";

export type ErrorMode = RaceStartedMessage["errorMode"];

// keys : touches de caractère pressées, pour la précision ; keyErrors : fautes par caractère attendu (ERR-3).
// blocked : en mode bloquant, la dernière touche était fausse et le curseur attend la bonne.
export type Typing = {
  typed: string;
  errors: number;
  keys: number;
  keyErrors: Record<string, number>;
  blocked: boolean;
};

export const EMPTY_TYPING: Typing = { typed: "", errors: 0, keys: 0, keyErrors: {}, blocked: false };

// Applique la nouvelle valeur du champ : caractères ajoutés à la fin ou effacés avec Retour arrière.
// Une faute compte toujours, même corrigée ensuite (ERR-1).
export function applyInput(state: Typing, text: string, mode: ErrorMode, value: string): Typing {
  if (value.startsWith(state.typed)) {
    let { typed, errors, keys, keyErrors, blocked } = state;
    for (const character of value.slice(typed.length)) {
      if (typed.length >= text.length) break;
      keys++;
      const expected = text[typed.length];
      const correct = character === expected;
      if (!correct) {
        errors++;
        keyErrors = { ...keyErrors, [expected]: (keyErrors[expected] ?? 0) + 1 };
      }
      // Bloquant : le mauvais caractère n'entre pas, le joueur doit taper le bon.
      if (mode === "blocking" && !correct) {
        blocked = true;
        continue;
      }
      typed += character;
      blocked = false;
    }
    return { typed, errors, keys, keyErrors, blocked };
  }
  // Effacer n'a de sens qu'en mode tolérant : en mode bloquant, tout ce qui est tapé est juste.
  if (mode === "tolerant" && state.typed.startsWith(value)) {
    return { ...state, typed: value };
  }
  // Modification au milieu du texte (curseur déplacé) : ignorée.
  return state;
}
