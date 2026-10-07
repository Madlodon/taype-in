import { expect, test } from "vitest";
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
