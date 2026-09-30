import { expect, test } from "vitest";
import en from "../messages/en.json";
import fr from "../messages/fr.json";

// Liste les clés à plat : { a: { b: "x" } } → ["a.b"].
function keys(messages: object, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "object" ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

test("Should_HaveSameKeys_When_ComparingFrenchAndEnglish", () => {
  expect(keys(en).sort()).toEqual(keys(fr).sort());
});
