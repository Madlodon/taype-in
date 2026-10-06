import { describe, expect, test } from "vitest";
import { buildHeatmap, heatLevel } from "../lib/heatmap";

describe("buildHeatmap", () => {
  test("Should_PutErrorsOnTheirKey_When_CharactersAreOnKeyboard", () => {
    expect(buildHeatmap([{ a: 2, " ": 1, ";": 3 }])).toEqual({
      keys: { a: 2, " ": 1, ";": 3 },
      extras: {},
      max: 3,
    });
  });

  test("Should_AddUpPlayers_When_HeatmapIsForWholeRace", () => {
    expect(buildHeatmap([{ a: 2, b: 1 }, { a: 3 }, {}]).keys).toEqual({ a: 5, b: 1 });
  });

  test("Should_CountOnLowercaseKey_When_CharacterIsUppercase", () => {
    expect(buildHeatmap([{ T: 2, t: 1 }]).keys).toEqual({ t: 3 });
  });

  test("Should_CountOnBaseKey_When_CharacterNeedsShift", () => {
    expect(buildHeatmap([{ "?": 1, "/": 1, "!": 2, '"': 1 }]).keys).toEqual({ "/": 2, 1: 2, "'": 1 });
  });

  test("Should_ListAsExtras_When_CharacterIsNotOnQwerty", () => {
    expect(buildHeatmap([{ é: 2, É: 1, à: 1, e: 1 }])).toEqual({
      keys: { e: 1 },
      extras: { é: 3, à: 1 },
      max: 3,
    });
  });

  test("Should_HaveZeroMax_When_NoErrors", () => {
    expect(buildHeatmap([])).toEqual({ keys: {}, extras: {}, max: 0 });
  });
});

describe("heatLevel", () => {
  test("Should_BeZero_When_KeyHasNoError", () => {
    expect(heatLevel(0, 5)).toBe(0);
  });

  test("Should_BeHighest_When_KeyIsTheWorst", () => {
    expect(heatLevel(5, 5)).toBe(4);
  });

  test("Should_BeLowest_When_KeyHasFewErrors", () => {
    expect(heatLevel(1, 10)).toBe(1);
  });

  test("Should_ScaleWithErrors_When_BetweenNoneAndWorst", () => {
    expect(heatLevel(5, 10)).toBe(2);
    expect(heatLevel(6, 10)).toBe(3);
  });
});
