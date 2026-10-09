// Anti-triche : le serveur refuse une saisie impossible (TECH-5).
import type { RemovedWord } from "./race-goals.ts";
import type { ErrorMode, Typing } from "./typing.ts";

type Progress = Pick<Typing, "typed" | "errors" | "keys">;

// Au-delà de 300 mots par minute (5 caractères par mot), la vitesse n'est plus humaine.
export const MAX_WPM = 300;
// Touches tolérées en plus, pour la latence du réseau au départ.
const BURST_KEYS = 10;

// before : dernière saisie acceptée ; elapsedMs : temps écoulé depuis le « Go ».
export function isPlausibleProgress(
  before: Progress,
  after: Progress,
  content: string,
  mode: ErrorMode,
  removed: RemovedWord[],
  elapsedMs: number,
  maxWpm = MAX_WPM,
) {
  // Les compteurs ne reculent jamais et chaque faute est une touche.
  if (after.keys < before.keys || after.errors < before.errors || after.errors > after.keys) return false;

  // Bloquant : seul le bon caractère entre. Tolérant : chaque caractère faux est une faute.
  let wrong = 0;
  for (let index = 0; index < after.typed.length; index++) {
    if (after.typed[index] !== content[index]) wrong++;
  }
  if (mode === "blocking" ? wrong > 0 : wrong > after.errors) return false;

  // Chaque caractère ajouté coûte une touche, sauf les mots retirés par un but (remis par le client).
  let common = 0;
  while (common < before.typed.length && before.typed[common] === after.typed[common]) common++;
  let added = 0;
  for (let index = common; index < after.typed.length; index++) {
    if (!removed.some((range) => index >= range.start && index < range.end)) added++;
  }
  if (added > after.keys - before.keys) return false;

  // Vitesse : pas plus de touches depuis le départ que ce qu'un humain peut taper.
  // Infinity : pas de limite (Infinity × 0 ms donnerait NaN).
  return maxWpm === Infinity || after.keys <= BURST_KEYS + ((maxWpm * 5) / 60_000) * elapsedMs;
}
