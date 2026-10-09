import { expect, test } from "vitest";
import { createFieldCars, stepFieldCars } from "../lib/field-motion";
import { DRIVING_AREA, dribbleBall } from "../lib/stadium-track";

test("Should_PreserveExistingPoses_When_RankingChangesAndCarsJoin", () => {
  const cars = stepFieldCars(createFieldCars(["you", "rival"]), 1 / 60);
  const changed = createFieldCars(["new", "rival", "you"], cars);
  for (const car of cars) expect(changed.find(other => other.id === car.id)).toEqual(car);
  const added = changed.find(car => car.id === "new")!;
  expect(cars.every(car => Math.hypot(car.x - added.x, car.y - added.y) >= 10)).toBe(true);
  expect(createFieldCars(["you"], changed)).toEqual([cars.find(car => car.id === "you")]);
});

test("Should_ChooseLeftRightAndStraight_WithTheAgreedProbabilitiesAndTiming", () => {
  const counts = [0, 0, 0];
  for (let index = 0; index < 4000; index++) {
    const car = { ...createFieldCars([`player-${index}`])[0], x: 0, y: 0, heading: 0, decisionIn: 0 };
    const next = stepFieldCars([car], 0)[0];
    counts[next.targetHeading > 0 ? 0 : next.targetHeading < 0 ? 1 : 2]++;
    expect(next.decisionIn).toBeGreaterThanOrEqual(2);
    expect(next.decisionIn).toBeLessThanOrEqual(4);
    if (next.targetHeading !== 0) expect(Math.abs(next.targetHeading)).toBeGreaterThanOrEqual(.6);
  }
  expect(counts[0] / 4000).toBeCloseTo(.25, 1);
  expect(counts[1] / 4000).toBeCloseTo(.25, 1);
  expect(counts[2] / 4000).toBeCloseTo(.5, 1);
});

test("Should_SteerAndSlowDown_When_TwoCarsApproachHeadOn", () => {
  let cars = createFieldCars(["a", "b"]).map((car, index) => ({ ...car,
    x: index === 0 ? -6 : 6, y: 0, heading: index * Math.PI,
    targetHeading: index * Math.PI, decisionIn: 20, speed: 6,
  }));
  const next = stepFieldCars(cars, 1 / 60);
  expect(next.every((car, index) => car.heading < cars[index].heading)).toBe(true);
  let minimumDistance = Infinity;
  let slowed = false;
  for (let step = 0; step < 600; step++) {
    const next = stepFieldCars(cars, 1 / 60);
    slowed ||= Math.hypot(next[0].x - cars[0].x, next[0].y - cars[0].y) < .08;
    cars = next;
    minimumDistance = Math.min(minimumDistance, Math.hypot(cars[0].x - cars[1].x, cars[0].y - cars[1].y));
  }
  expect(slowed).toBe(true);
  expect(minimumDistance).toBeGreaterThan(4.2);
});

test("Should_ResumeNormalSpeed_When_ThePathClears", () => {
  const [car, other] = createFieldCars(["a", "b"]);
  const driver = { ...car, x: 0, y: 0, heading: 0, targetHeading: 0, decisionIn: 10 };
  const obstacle = { ...other, x: 6, y: 0 };
  const slow = stepFieldCars([driver, obstacle], 1 / 60)[0];
  const clear = stepFieldCars([slow], 1 / 60)[0];
  expect(Math.hypot(clear.x - slow.x, clear.y - slow.y)).toBeCloseTo(car.speed / 60);
  expect(Math.hypot(slow.x, slow.y)).toBeLessThan(car.speed / 60);
});

test("Should_KeepCarsAndDribbledBallsInsideTheGrass_DuringLongBoostedWandering", () => {
  const ids = ["you", "nova", "echo", "blitz", ...Array.from({ length: 10 }, (_, i) => `player-${i}`)];
  let cars = createFieldCars(ids);
  let maxX = 0, maxY = 0, maxTurn = 0, maxDistance = 0;
  const visited = new Set<string>();
  for (let step = 0; step < 60 * 180; step++) {
    const next = stepFieldCars(cars, 1 / 60, new Set(ids));
    for (let index = 0; index < cars.length; index++) {
      const car = next[index], previous = cars[index];
      const ball = dribbleBall(car, step / 60, .5, "dominus");
      maxX = Math.max(maxX, Math.abs(car.x) + 2.1, Math.abs(ball.x) + 1.3);
      maxY = Math.max(maxY, Math.abs(car.y) + 2.1, Math.abs(ball.y) + 1.3);
      maxTurn = Math.max(maxTurn, Math.abs(car.heading - previous.heading));
      maxDistance = Math.max(maxDistance, Math.hypot(car.x - previous.x, car.y - previous.y));
    }
    cars = next;
    visited.add(`${Math.floor(cars[0].x / 8)},${Math.floor(cars[0].y / 8)}`);
  }
  expect(maxX).toBeLessThan(DRIVING_AREA.halfLength);
  expect(maxY).toBeLessThan(DRIVING_AREA.halfWidth);
  expect(maxTurn).toBeLessThan(.027);
  expect(maxDistance).toBeLessThan(14 / 60 + 1e-8);
  expect(visited.size).toBeGreaterThan(15);
});

test("Should_DoubleTravel_When_BoostingOnAClearStretch", () => {
  const cars = createFieldCars(["you"]).map(car => ({ ...car, x: 0, y: 0, heading: 0, targetHeading: 0 }));
  const normal = stepFieldCars(cars, 1 / 60)[0];
  const boosted = stepFieldCars(cars, 1 / 60, new Set(["you"]))[0];
  expect(boosted.x).toBeCloseTo(normal.x * 2);
  expect(cars[0].x).toBe(0);
});

test("Should_KeepWanderingPreviewCarsApart_OverSeveralMinutes", () => {
  let cars = createFieldCars(["you", "nova", "blitz", "echo"]);
  let minimumDistance = Infinity;
  for (let step = 0; step < 60 * 300; step++) {
    cars = stepFieldCars(cars, 1 / 60);
    for (const [index, car] of cars.entries()) for (const other of cars.slice(index + 1)) {
      minimumDistance = Math.min(minimumDistance, Math.hypot(car.x - other.x, car.y - other.y));
    }
  }
  expect(minimumDistance).toBeGreaterThan(4.2);
});
