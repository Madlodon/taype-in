import { expect, test } from "vitest";
import { DRIVING_AREA, MAX_CAR_SCALE, fieldPose } from "../lib/stadium-track";
import { battleCars } from "../components/hero-battle";

test("Should_StartEveryCarAtTheKickoff_When_TheLapBegins", () => {
  expect(battleCars(0, "Toi").every(car => car.progress === 0)).toBe(true);
});

test("Should_ShowOneBlueCarNamedAfterThePlayer_When_Rendered", () => {
  const yours = battleCars(0, "alex").filter(car => car.you);

  expect(yours).toHaveLength(1);
  expect(yours[0].name).toBe("alex");
});

test("Should_SpreadCarsAlongTheRoute_When_TheRaceIsUnderway", () => {
  const progresses = battleCars(6000, "Toi").map(car => car.progress);

  expect(new Set(progresses).size).toBe(progresses.length);
});

test("Should_ParkTheLeaderInTheGoal_When_TheLapEnds", () => {
  const cars = battleCars(12500, "Toi");

  expect(Math.max(...cars.map(car => car.progress))).toBe(1);
  expect(cars.every(car => car.progress <= 1)).toBe(true);
});

test("Should_RestartTheRace_When_ThePauseIsOver", () => {
  expect(battleCars(14000, "Toi").every(car => car.progress === 0)).toBe(true);
});

test("Should_UseTheFourGarageCarsAndExistingBallDesigns", () => {
  const cars = battleCars(6000, "You");
  expect(cars.map(car => car.body)).toEqual(["octane", "fennec", "dominus", "merc"]);
  expect(cars.map(car => car.ball)).toEqual(["none", "gold", "glacier", "emerald"]);
});


test("Should_KeepPreviewCarsOnSeparateLoopsThroughoutTheBattle", () => {
  const cars = battleCars(0, "You");
  expect(new Set(cars.map(car => car.lane)).size).toBe(cars.length);
  const clearance = 2 * Math.hypot(3.6, 2) * MAX_CAR_SCALE;
  for (let seconds = 0; seconds < 300; seconds += .05) {
    const poses = cars.map(car => fieldPose(seconds, car.id, car.lane));
    for (const [index, pose] of poses.entries()) {
      expect(Math.abs(pose.x) + clearance / 2).toBeLessThan(DRIVING_AREA.halfLength);
      expect(Math.abs(pose.y) + clearance / 2).toBeLessThan(DRIVING_AREA.halfWidth);
      for (const other of poses.slice(index + 1)) {
        expect(Math.hypot(pose.x - other.x, pose.y - other.y)).toBeGreaterThan(clearance);
      }
    }
  }
});
