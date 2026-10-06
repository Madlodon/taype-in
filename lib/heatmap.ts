// Heatmap du clavier : fautes par touche, pour un joueur ou toute la course (FIN-3).

// Clavier QWERTY, une chaîne par rangée ; la barre d'espace est à part.
export const KEYBOARD_ROWS = ["`1234567890-=", "qwertyuiop[]\\", "asdfghjkl;'", "zxcvbnm,./"];

// Caractères tapés avec Maj : comptés sur la touche qui les porte.
const SHIFTED: Record<string, string> = {
  "~": "`", "!": "1", "@": "2", "#": "3", $: "4", "%": "5", "^": "6", "&": "7", "*": "8",
  "(": "9", ")": "0", _: "-", "+": "=", "{": "[", "}": "]", "|": "\\", ":": ";", '"': "'",
  "<": ",", ">": ".", "?": "/",
};

const ON_KEYBOARD = new Set([...KEYBOARD_ROWS.join(""), " "]);

// keys : fautes par touche du clavier ; extras : caractères absents du QWERTY (é, à, ç…) ;
// max : la touche la plus fautive, pour l'intensité des couleurs.
export type Heatmap = {
  keys: Record<string, number>;
  extras: Record<string, number>;
  max: number;
};

// Additionne les fautes de chaque joueur ; une majuscule compte sur sa minuscule.
export function buildHeatmap(keyErrorsList: Record<string, number>[]): Heatmap {
  const keys: Record<string, number> = {};
  const extras: Record<string, number> = {};
  for (const keyErrors of keyErrorsList) {
    for (const [character, errors] of Object.entries(keyErrors)) {
      const key = SHIFTED[character] ?? character.toLowerCase();
      const target = ON_KEYBOARD.has(key) ? keys : extras;
      target[key] = (target[key] ?? 0) + errors;
    }
  }
  const max = Math.max(0, ...Object.values(keys), ...Object.values(extras));
  return { keys, extras, max };
}

// Intensité de 0 (aucune faute) à 4 (la touche la plus fautive).
export function heatLevel(errors: number, max: number): number {
  if (errors <= 0 || max <= 0) return 0;
  return Math.ceil((errors / max) * 4);
}
