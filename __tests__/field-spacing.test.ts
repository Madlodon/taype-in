import { expect, test } from "vitest";
import { createFieldCars, createFieldBalls, fieldClearance, stepFieldCars, stepFieldBalls } from "../lib/field-motion";
import { DRIVING_AREA } from "../lib/stadium-track";

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

test.each([.45, 1.4])("Should_SpawnInFreeSpaceAndPreserveRankedPoses_AtScale_%s", scale => {
  for (let seed = 0; seed < 30; seed++) {
    const ids = Array.from({ length: 5 }, (_, i) => `${seed}-player-${i}`);
    const cars = createFieldCars(ids, [], scale);
    expect(createFieldCars([...ids].reverse(), [], scale)).toEqual(cars);
    for (const [i, car] of cars.entries()) for (const other of cars.slice(i + 1)) {
      expect(distance(car, other)).toBeGreaterThanOrEqual(fieldClearance(scale) + 4);
    }
    const moved = stepFieldCars(cars, 1 / 60, new Set(), new Map());
    const changed = createFieldCars(["new", ...ids.slice(1).reverse()], moved, scale);
    for (const car of moved.slice(1)) expect(changed.find(other => other.id === car.id)).toBe(car);
    const newcomer = changed.find(car => car.id === "new")!;
    for (const car of changed.filter(car => car !== newcomer)) {
      expect(distance(car, newcomer)).toBeGreaterThanOrEqual(fieldClearance(scale) + 4);
    }
  }
  expect(fieldClearance(scale)).toBe(scale === .45 ? 9.6 : 10);
});

test.each([.45, 1.4].flatMap(scale => [false, true].flatMap(boost => [false, true].map(crossing => ({ scale, boost, crossing })))))
("Should_PassThroughWithoutDetouring_$scale boost $boost crossing $crossing", ({ scale, boost, crossing }) => {
  let cars = createFieldCars(["a", "b"], [], scale).map((car, i) => ({ ...car,
    x: i === 0 ? -12 : crossing ? 0 : 12, y: i === 1 && crossing ? -12 : 0,
    heading: i === 0 ? 0 : crossing ? Math.PI / 2 : Math.PI,
    targetHeading: i === 0 ? 0 : crossing ? Math.PI / 2 : Math.PI, decisionIn: 20, speed: 6,
  }));
  const targets = new Map(createFieldBalls(cars).map((ball, i) => [ball.id, { ...ball,
    x: i === 0 ? 12 : crossing ? 0 : -12, y: i === 1 && crossing ? 12 : 0,
  }]));
  const travelled = cars.map(() => 0);
  let minimum = Infinity;
  for (let step = 0; step < 60 * (boost ? 1.1 : 2.1); step++) {
    const next = stepFieldCars(cars, 1 / 60, new Set(boost ? ["a", "b"] : []), targets);
    minimum = Math.min(minimum, distance(next[0], next[1]));
    for (let i = 0; i < cars.length; i++) {
      travelled[i] += distance(next[i], cars[i]);
      expect(Math.abs(next[i].heading - cars[i].heading)).toBeLessThanOrEqual(1.6 / 60 + 1e-10);
      expect(distance(next[i], cars[i])).toBeLessThanOrEqual((boost ? 12 : 6) / 60 + 1e-10);
      expect(next[i].heading).toBeCloseTo(cars[i].heading);
      expect(distance(next[i], cars[i])).toBeCloseTo((boost ? 12 : 6) / 60);
    }
    cars = next;
  }
  expect(minimum).toBeLessThan(.01);
  for (const length of travelled) expect(length).toBeGreaterThan(12);
});

test.each([.45, 1.4].flatMap(scale => [0, 1, 2].map(seed => ({ scale, seed }))))
("Should_KeepFiveCarsActiveAndInsideBounds_$scale seed $seed", ({ scale, seed }) => {
  const ids = Array.from({ length: 5 }, (_, i) => `${seed}-racer-${i}`);
  let cars = createFieldCars(ids, [], scale), balls = createFieldBalls(cars, [], scale);
  let travelled = cars.map(() => 0);
  for (let step = 0; step < 60 * 180; step++) {
    const boosting = new Set(step % 180 < 21 ? ids : []);
    const next = stepFieldCars(cars, 1 / 60, boosting, new Map(balls.map(ball => [ball.id, ball])));
    balls = stepFieldBalls(balls, next, 1 / 60, boosting, scale);
    for (let i = 0; i < cars.length; i++) {
      travelled[i] += distance(cars[i], next[i]);
      expect(Math.abs(next[i].x)).toBeLessThanOrEqual(DRIVING_AREA.halfLength - 7.5);
      expect(Math.abs(next[i].y)).toBeLessThanOrEqual(DRIVING_AREA.halfWidth - 7.5);
    }
    cars = next;
    if ((step + 1) % (60 * 30) === 0) {
      for (const length of travelled) expect(length).toBeGreaterThan(10);
      travelled = cars.map(() => 0);
    }
  }
  for (const ball of balls) expect(ball.contacts).toBeGreaterThan(5);
});
