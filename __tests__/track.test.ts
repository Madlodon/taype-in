import { expect, test } from "vitest";
import { detectOvertake, selectShown } from "../lib/track";

// Classement de `count` joueurs : p1 en tête, puis p2, p3…
function positions(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    username: `joueur${index + 1}`,
    position: count - index,
    wpm: 0,
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
    wpm: 0,
    rank: 2,
  });
});

// Classement dans l'ordre donné ; le joueur « p » a l'id p et le nom joueur-p.
function order(...ids: string[]) {
  return ids.map((id, index) => ({
    id,
    username: `joueur-${id}`,
    position: ids.length - index,
    wpm: 0,
  }));
}

test("Should_ReportPassedPlayer_When_UserMovesUp", () => {
  expect(detectOvertake(order("a", "me", "b"), order("me", "a", "b"), "me")).toEqual({
    direction: "up",
    names: ["joueur-a"],
    rank: 1,
  });
});

test("Should_ReportPasser_When_UserMovesDown", () => {
  expect(detectOvertake(order("a", "me", "b"), order("a", "b", "me"), "me")).toEqual({
    direction: "down",
    names: ["joueur-b"],
    rank: 3,
  });
});

test("Should_ReportEveryPassedPlayer_When_UserPassesSeveralAtOnce", () => {
  expect(detectOvertake(order("a", "b", "me"), order("me", "a", "b"), "me")?.names).toEqual([
    "joueur-a",
    "joueur-b",
  ]);
});

test("Should_ReportNothing_When_UserRankIsUnchanged", () => {
  expect(detectOvertake(order("a", "me", "b"), order("a", "me", "b"), "me")).toBeNull();
});

test("Should_ReportNothing_When_OthersSwapAroundUser", () => {
  expect(detectOvertake(order("a", "b", "me"), order("b", "a", "me"), "me")).toBeNull();
});

test("Should_ReportNothing_When_FirstPositionsArrive", () => {
  expect(detectOvertake([], order("a", "me"), "me")).toBeNull();
});

test("Should_ReportNothing_When_UserIsNotRacing", () => {
  expect(detectOvertake(order("a", "b"), order("b", "a"), "spectateur")).toBeNull();
});

test("Should_ReportNothing_When_RankChangesOnlyBecauseNewPlayerAppears", () => {
  expect(detectOvertake(order("a", "me"), order("a", "new", "me"), "me")).toBeNull();
});
