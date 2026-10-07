// @vitest-environment node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

// Variables fournies par l'outillage, pas par le fichier .env.
const TOOLING_VARIABLES = ["CI", "NODE_ENV"];

const lines = readFileSync(".env.example", "utf8").split("\n");

// Lignes « NOM=valeur », actives ou en commentaire (« # NOM=valeur »).
function documentedVariables() {
  return lines.flatMap((line) => line.match(/^(?:# )?([A-Z_]+)=/)?.[1] ?? []);
}

test("Should_ListEveryVariable_When_CodeReadsProcessEnv", () => {
  const files = execFileSync("git", ["ls-files", "*.ts", "*.tsx"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  const used = new Set(
    files.flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/process\.env\.([A-Z_]+)/g)].map((m) => m[1]),
    ),
  );
  const missing = [...used].filter(
    (name) => !TOOLING_VARIABLES.includes(name) && !documentedVariables().includes(name),
  );

  expect(missing).toEqual([]);
});

test("Should_HaveComment_When_VariableIsListed", () => {
  const uncommented = lines
    .map((line, index) => ({ line, previous: lines[index - 1] ?? "" }))
    .filter(({ line }) => /^[A-Z_]+=/.test(line))
    .filter(({ previous }) => !previous.startsWith("#"))
    .map(({ line }) => line.split("=")[0]);

  expect(uncommented).toEqual([]);
});
