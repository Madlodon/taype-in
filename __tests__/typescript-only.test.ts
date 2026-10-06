// @vitest-environment node
import { execFileSync } from "node:child_process";
import { ESLint } from "eslint";
import { expect, test } from "vitest";

const eslint = new ESLint();

// Lint du code en mémoire, comme s'il était dans lib/.
async function lint(code: string) {
  const [result] = await eslint.lintText(code, { filePath: "lib/example.ts" });
  return result.messages.map((message) => message.ruleId);
}

test("Should_HaveNoJavaScriptFiles_When_ListingTrackedFiles", () => {
  const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n");

  expect(files.filter((file) => /\.jsx?$/.test(file))).toEqual([]);
});

test("Should_ReportError_When_UsingExplicitAny", async () => {
  expect(await lint("export const value: any = 1;\n")).toContain(
    "@typescript-eslint/no-explicit-any",
  );
});

test("Should_ReportError_When_UsingTsIgnore", async () => {
  expect(
    await lint("// @ts-ignore la valeur est un nombre\nexport const value: number = '1';\n"),
  ).toContain("@typescript-eslint/ban-ts-comment");
});

test("Should_ReportError_When_TsExpectErrorHasNoComment", async () => {
  expect(await lint("// @ts-expect-error\nexport const value: number = '1';\n")).toContain(
    "@typescript-eslint/ban-ts-comment",
  );
});

test("Should_Pass_When_TsExpectErrorIsJustified", async () => {
  expect(
    await lint(
      "// @ts-expect-error -- teste le refus d'une chaîne\nexport const value: number = '1';\n",
    ),
  ).not.toContain("@typescript-eslint/ban-ts-comment");
});
