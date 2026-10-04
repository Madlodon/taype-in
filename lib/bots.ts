// Bots ajoutés par l'hôte (BOT-1, BOT-2) : ils courent comme des joueurs, mais rien n'est enregistré pour eux.
// Sans accès à la base : la salle d'attente l'importe côté client.
import { applyInput, type ErrorMode, type Typing } from "./typing.ts";

export const BOT_LEVELS = ["beginner", "intermediate", "advanced", "expert"] as const;

export type BotLevel = (typeof BOT_LEVELS)[number];

// Un bot s'affiche « Bot Expert 2 » : son niveau et son numéro parmi les bots de ce niveau (BOT-3).
export type Bot = { level: BotLevel; number: number };

// Vitesse moyenne visée (MPM) et part de touches fausses, par niveau.
export const BOT_PROFILES: Record<BotLevel, { wpm: number; errorRate: number }> = {
  beginner: { wpm: 25, errorRate: 0.08 },
  intermediate: { wpm: 45, errorRate: 0.05 },
  advanced: { wpm: 70, errorRate: 0.03 },
  expert: { wpm: 100, errorRate: 0.01 },
};

// Ralentissement au hasard : de temps en temps, le bot hésite le temps de quelques touches.
const SLOWDOWN_RATE = 1 / 30;
const SLOWDOWN_KEYS = 4;

// Prochaine touche du bot : le délai avant de la taper (ms) et la saisie qui en résulte.
// Une faute passe par applyInput, comme pour un joueur : en mode bloquant, il doit retaper le bon caractère.
export function botKey(
  level: BotLevel,
  typing: Typing,
  content: string,
  mode: ErrorMode,
  random: () => number = Math.random,
): { delayMs: number; typing: Typing } {
  const { wpm, errorRate } = BOT_PROFILES[level];
  // 12 000 ÷ MPM = ms par caractère ; les fautes et les pauses sont prises dessus pour garder la moyenne.
  const keyMs = 12_000 / wpm / ((1 + errorRate) * (1 + SLOWDOWN_RATE * SLOWDOWN_KEYS));
  let delayMs = keyMs * (0.5 + random());
  if (random() < SLOWDOWN_RATE) delayMs += keyMs * SLOWDOWN_KEYS * (0.5 + random());

  const expected = content[typing.typed.length];
  const wrong = expected === "x" ? "z" : "x";
  const key = random() < errorRate ? wrong : expected;
  return { delayMs, typing: applyInput(typing, content, mode, typing.typed + key) };
}
