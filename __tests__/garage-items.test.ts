import { expect, test } from "vitest";
import { DEFAULT_LOADOUT, lockLoadout, unlockedBetween, unlockLevel } from "../lib/garage-items";

test("Should_BeFree_When_ItemIsDefault", () => {
  expect(unlockLevel("car", "octane")).toBe(1);
  expect(unlockLevel("hat", "none")).toBe(1);
});

test("Should_FollowTable_When_ItemIsLocked", () => {
  expect(unlockLevel("hat", "cone")).toBe(2);
  expect(unlockLevel("car", "fennec")).toBe(12);
  expect(unlockLevel("boost", "alpha")).toBe(15);
});

test("Should_KeepUnlockedItems_When_LockingLoadout", () => {
  const loadout = { ...DEFAULT_LOADOUT, boost: "flames", hat: "cone" } as const;

  expect(lockLoadout(loadout, 3)).toEqual(loadout);
});

test("Should_ResetItemsAboveLevel_When_LockingLoadout", () => {
  const loadout = { car: "fennec", boost: "ion", hat: "cone", ball: "gold", stadium: "top-down" } as const;

  expect(lockLoadout(loadout, 6)).toEqual({ ...DEFAULT_LOADOUT, boost: "ion", hat: "cone", stadium: "top-down" });
});

test("Should_ListNewItems_When_LevellingUp", () => {
  expect(unlockedBetween(6, 8)).toEqual([
    { category: "car", item: "dominus" },
    { category: "hat", item: "wizard" },
    { category: "hat", item: "top-hat" },
    { category: "ball", item: "glacier" },
  ]);
});

test("Should_ListNothing_When_LevelDidNotChange", () => {
  expect(unlockedBetween(9, 9)).toEqual([]);
});
