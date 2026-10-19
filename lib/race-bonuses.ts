// Bonus des courses où l'hôte les active (BON-1 à BON-3) : un but à un point de contrôle donne un effet au hasard.
import { WORD_PATTERN, type RemovedWord } from "./race-goals.ts";

// removeWords aide celui qui marque ; les autres visent le plus avancé encore en course.
export const BONUS_EFFECTS = ["removeWords", "addWords", "blur", "shrink", "slowLetters", "shuffleWord"] as const;
export type BonusEffect = (typeof BONUS_EFFECTS)[number];

// Flou, texte réduit : 5 s. Attente : 1 s avant chacune des 3 prochaines lettres.
export const BONUS_MS = 5000;
export const SLOW_LETTERS = 3;
export const SLOW_LETTER_MS = 1000;
export const ADDED_WORDS = 3;

// Points de contrôle du meneur (BONUS-01) : chaque fois qu'il en passe un, les joueurs en retard
// reçoivent un bonus. Un seul par point de contrôle, donc au plus 3 par joueur et par course.
export const CHECKPOINTS = [0.25, 0.5, 0.75];
export const BEHIND_GAP = 0.25;

// Nombre de points de contrôle passés par le meneur ; progress = part du texte tapée.
export function checkpointsPassed(leader: number) {
  return CHECKPOINTS.filter((checkpoint) => leader >= checkpoint).length;
}

// En retard : dernier, ou plus de 25 % du texte derrière le meneur. Le meneur ne l'est jamais.
export function isBehind(progress: number[], mine: number) {
  const leader = Math.max(...progress);
  return mine < leader && (mine === Math.min(...progress) || leader - mine > BEHIND_GAP);
}

// Effets possibles : sans cible, seulement retirer des mots ; un bot ne voit pas d'écran à flouter.
export function availableEffects(target: { bot: boolean } | undefined): BonusEffect[] {
  if (!target) return ["removeWords"];
  return BONUS_EFFECTS.filter((effect) => !(target.bot && (effect === "blur" || effect === "shrink")));
}

// Ajoute des mots du texte, pris au hasard, juste après le mot en cours.
// Les mots retirés plus loin glissent d'autant.
export function addWords(content: string, cursor: number, removed: RemovedWord[], random: () => number) {
  const words = [...content.matchAll(WORD_PATTERN)].map((match) => match[0]);
  const added = Array.from({ length: ADDED_WORDS }, () => words[Math.floor(random() * words.length)]);
  const space = content.slice(cursor).search(/\s/);
  const at = space === -1 ? content.length : cursor + space;
  const inserted = ` ${added.join(" ")}`;
  return {
    content: content.slice(0, at) + inserted + content.slice(at),
    removed: removed.map((range) =>
      range.start >= at ? { start: range.start + inserted.length, end: range.end + inserted.length } : range,
    ),
  };
}

// Mélange les lettres du prochain mot pas encore commencé ; undefined s'il n'y en a pas.
export function shuffleNextWord(content: string, cursor: number, removed: RemovedWord[], random: () => number) {
  const word = [...content.matchAll(WORD_PATTERN)].find(
    (match) =>
      match.index >= cursor &&
      new Set(match[0]).size > 1 &&
      !removed.some((range) => match.index >= range.start && match.index < range.end),
  );
  if (!word) return undefined;
  const letters = [...word[0]];
  for (let index = letters.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [letters[index], letters[other]] = [letters[other], letters[index]];
  }
  // Un mélange identique au mot devient une rotation, toujours différente (au moins deux lettres distinctes).
  let shuffled = letters.join("");
  if (shuffled === word[0]) shuffled = word[0].slice(1) + word[0][0];
  return content.slice(0, word.index) + shuffled + content.slice(word.index + word[0].length);
}
