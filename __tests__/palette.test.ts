import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const css = readFileSync("app/globals.css", "utf8");

// Lit les variables --nom: #rrggbb d'un bloc CSS (:root ou .dark).
function tokens(selector: string): Record<string, string> {
  const block = css.split(`${selector} {`)[1].split("}")[0];
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]));
}

// Formule de luminance relative et de contraste des WCAG 2.2.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

// Texte : 4,5:1. Composants et éléments graphiques (bordures, curseur) : 3:1.
const pairs: [string, string, number][] = [
  ["foreground", "background", 4.5],
  ["foreground", "surface", 4.5],
  ["muted", "background", 4.5],
  ["muted", "surface", 4.5],
  ["primary-foreground", "primary", 4.5],
  ["accent-foreground", "accent", 4.5],
  ["accent-strong", "background", 4.5],
  ["correct", "background", 4.5],
  ["wrong", "background", 4.5],
  ["wrong", "wrong-surface", 4.5],
  ["foreground", "wrong-surface", 4.5],
  ["primary", "background", 3],
  ["border", "background", 3],
  ["border", "surface", 3],
];

describe.each([":root", ".dark"])("%s", (selector) => {
  const theme = tokens(selector);

  test.each(pairs)("Should_MeetAA_When_%s_On_%s", (text, background, minimum) => {
    expect(contrast(theme[text], theme[background])).toBeGreaterThanOrEqual(minimum);
  });
});
