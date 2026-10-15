// Bots ajoutés par l'hôte (BOT-01 à BOT-05) : ils courent comme des joueurs, mais rien n'est enregistré pour eux.
// Sans accès à la base : la salle d'attente l'importe côté client.
import type { RemovedWord } from "./race-goals.ts";
import { applyInput, type ErrorMode, type Typing } from "./typing.ts";

export const BOT_LEVELS = ["noob", "beginner", "intermediate", "expert", "impossible"] as const;

export type BotLevel = (typeof BOT_LEVELS)[number];

// Un bot s'affiche « Bot Expert 2 » : son niveau et son numéro parmi les bots de ce niveau.
export type Bot = { level: BotLevel; number: number };

// Plage de vitesse (MPM, sur un texte simple) et part de touches fausses, par niveau (BOT-01).
export const BOT_PROFILES: Record<BotLevel, { minWpm: number; maxWpm: number; errorRate: number }> = {
  noob: { minWpm: 10, maxWpm: 20, errorRate: 0.12 },
  beginner: { minWpm: 20, maxWpm: 35, errorRate: 0.08 },
  intermediate: { minWpm: 35, maxWpm: 60, errorRate: 0.05 },
  expert: { minWpm: 70, maxWpm: 100, errorRate: 0.02 },
  impossible: { minWpm: 140, maxWpm: 170, errorRate: 0.005 },
};

// XP d'une course contre des bots (#35) : multipliée selon leur difficulté.
export const BOT_XP_MULTIPLIERS: Record<BotLevel, number> = {
  noob: 0.25,
  beginner: 0.5,
  intermediate: 1,
  expert: 1.5,
  impossible: 2,
};

// Moyenne sur tous les coureurs : chaque bot selon son niveau, chaque joueur compte pour ×1.
export function xpMultiplier(bots: BotLevel[], humans: number): number {
  if (bots.length + humans === 0) return 1;
  const total = bots.reduce((sum, level) => sum + BOT_XP_MULTIPLIERS[level], humans);
  return total / (bots.length + humans);
}

// Générateur pseudo-aléatoire à graine (mulberry32) : la même graine donne toujours la même suite (BOT-05).
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

// Graine d'un bot dans une course, tirée de la course et du bot (hachage FNV-1a).
export function botSeed(raceId: string, bot: Bot): number {
  let seed = 2_166_136_261;
  for (const character of `${raceId}:${bot.level}:${bot.number}`) {
    seed = Math.imul(seed ^ character.charCodeAt(0), 16_777_619);
  }
  return seed >>> 0;
}

// Rythme (BOT-02) : le bot tape par séries de quelques touches, plus vite, normalement ou en hésitant.
const PACES = [
  { chance: 0.3, factor: 0.7 },
  { chance: 0.5, factor: 1 },
  { chance: 0.2, factor: 2.5 },
];
const AVERAGE_PACE = PACES.reduce((sum, { chance, factor }) => sum + chance * factor, 0);
// Un mot difficile (long, accent, majuscule, ponctuation) se tape plus lentement.
const HARD_WORD_FACTOR = 1.5;
// Après une faute, le bot s'arrête le temps de deux touches pour la remarquer (BOT-03).
const CORRECTION_KEYS = 2;

// Moteur d'un bot pour une course : sa vitesse, tirée dans la plage de son niveau, et son hasard à graine.
export type BotEngine = {
  level: BotLevel;
  wpm: number;
  random: () => number;
  pace: number;
  paceKeys: number;
};

export function createBotEngine(level: BotLevel, seed: number): BotEngine {
  const random = seededRandom(seed);
  const { minWpm, maxWpm } = BOT_PROFILES[level];
  return { level, wpm: minWpm + (maxWpm - minWpm) * random(), random, pace: 1, paceKeys: 0 };
}

// Le mot (suite sans espace) qui contient ce caractère est-il difficile ?
export function isHardWord(content: string, index: number): boolean {
  if (/\s/.test(content[index] ?? " ")) return false;
  let start = index;
  while (start > 0 && !/\s/.test(content[start - 1])) start--;
  let end = index;
  while (end < content.length && !/\s/.test(content[end])) end++;
  const word = content.slice(start, end);
  return word.length >= 8 || /[^a-z0-9]/.test(word);
}

// Prochaine touche du bot : le délai avant de la taper (ms) et la saisie qui en résulte.
// Une faute passe par applyInput, comme pour un joueur : en mode bloquant, il doit retaper le bon caractère.
// Les mots retirés par un but sont sautés, comme pour un joueur (BOT-04).
export function botKey(
  engine: BotEngine,
  typing: Typing,
  content: string,
  mode: ErrorMode,
  removed: RemovedWord[] = [],
): { delayMs: number; typing: Typing } {
  const { random } = engine;
  const { errorRate } = BOT_PROFILES[engine.level];
  if (engine.paceKeys <= 0) {
    const roll = random();
    let cumulative = 0;
    engine.pace = PACES.find(({ chance }) => roll < (cumulative += chance))?.factor ?? 1;
    engine.paceKeys = 5 + Math.floor(random() * 15);
  }
  engine.paceKeys--;

  // 12 000 ÷ MPM = ms par caractère juste. Les fautes, leur correction et le rythme sont pris
  // sur ce temps, pour que la vitesse moyenne sur un texte simple reste celle du bot.
  const keyMs =
    (12_000 * (1 - errorRate)) / (engine.wpm * AVERAGE_PACE * (1 + CORRECTION_KEYS * errorRate));
  const index = typing.typed.length;
  const hard = isHardWord(content, index) ? HARD_WORD_FACTOR : 1;
  let delayMs = keyMs * engine.pace * hard * (0.5 + random());

  const expected = content[index];
  const mistake = random() < errorRate;
  const key = mistake ? (expected === "x" ? "z" : "x") : expected;
  if (mistake) delayMs += keyMs * engine.pace * CORRECTION_KEYS;

  let next = applyInput(typing, content, mode, typing.typed + key);
  let range = removed.find(({ start }) => start === next.typed.length);
  while (range) {
    next = { ...next, typed: next.typed + content.slice(range.start, range.end) };
    range = removed.find(({ start }) => start === next.typed.length);
  }
  return { delayMs, typing: next };
}
