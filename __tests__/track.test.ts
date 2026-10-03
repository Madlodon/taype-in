import { expect, test } from "vitest";
import { selectShown } from "../lib/track";

// Classement de `count` joueurs : p1 en tête, puis p2, p3…
function positions(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    username: `joueur${index + 1}`,
    position: count - index,
  }));
}

const ranks = (count: number, userId: string) =>
  selectShown(positions(count), userId).map((entry) => entry.rank);

test("Should_ShowEveryone_When_TenPlayersOrLess", () => {
  expect(ranks(4, "p3")).toEqual([1, 2, 3, 4]);
});

test("Should_ShowOnlyTopTen_When_UserIsInTopTen", () => {
  expect(ranks(30, "p10")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("Should_AddPlayerJustAheadAndBehind_When_UserIsBelowTopTen", () => {
  expect(ranks(30, "p15")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 15, 16]);
});

test("Should_AddOnlyUserAndNextOne_When_UserIsEleventh", () => {
  expect(ranks(30, "p11")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test("Should_AddOnlyPlayerAhead_When_UserIsLast", () => {
  expect(ranks(30, "p30")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 29, 30]);
});

test("Should_ShowOnlyTopTen_When_UserIsNotRacing", () => {
  expect(ranks(30, "spectateur")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("Should_ShowNobody_When_NoPositions", () => {
  expect(selectShown([], "p1")).toEqual([]);
});

test("Should_KeepPlayerData_When_Selected", () => {
  expect(selectShown(positions(2), "p2")[1]).toEqual({
    id: "p2",
    username: "joueur2",
    position: 1,
    rank: 2,
  });
});
