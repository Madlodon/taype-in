import { expect, test } from "vitest";
import { createFieldCars, stepFieldCars, createFieldBalls, stepFieldBalls, launchFieldShot } from "../lib/field-motion";
import { DRIVING_AREA, ballContactDistance } from "../lib/stadium-track";

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
  let balls = createFieldBalls(cars);
  let maxX = 0, maxY = 0, maxTurn = 0, maxDistance = 0;
  const visited = new Set<string>();
  for (let step = 0; step < 60 * 180; step++) {
    const next = stepFieldCars(cars, 1 / 60, new Set(ids));
    balls = stepFieldBalls(balls, next, 1 / 60, new Set(ids));
    for (let index = 0; index < cars.length; index++) {
      const car = next[index], previous = cars[index];
      const ball = balls[index];
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


test.each([false, true])("Should_KickTravelAndCatchRepeatedly_WithBoost_%s", boosted => {
  let cars = createFieldCars(["you"]).map(car => ({ ...car, x: 0, y: 0, heading: 0, targetHeading: 0 }));
  let balls = createFieldBalls(cars);
  const boosting = new Set(boosted ? ["you"] : []);
  let maxGap = 0, increasing = false, decreasing = false, gap = 0;
  for (let step = 0; step < 60 * 60; step++) {
    cars = stepFieldCars(cars, 1 / 60, boosting, new Map(balls.map(ball => [ball.id, ball])));
    const previous = balls[0];
    balls = stepFieldBalls(balls, cars, 1 / 60, boosting);
    const nextGap = Math.hypot(balls[0].x - cars[0].x, balls[0].y - cars[0].y);
    increasing ||= nextGap > gap + .01; decreasing ||= nextGap < gap - .01;
    maxGap = Math.max(maxGap, nextGap); gap = nextGap;
    expect(Math.hypot(balls[0].x - previous.x, balls[0].y - previous.y)).toBeLessThan(.5);
    expect(Math.abs(balls[0].x) + 1.2).toBeLessThan(DRIVING_AREA.halfLength);
    expect(Math.abs(balls[0].y) + 1.2).toBeLessThan(DRIVING_AREA.halfWidth);
  }
  expect(increasing && decreasing).toBe(true);
  expect(maxGap).toBeGreaterThan(ballContactDistance(.45) + 1);
  expect(balls[0].contacts).toBeGreaterThan(5);
});

test("Should_KeepBallVelocityIndependent_When_TheCarTurnsAfterContact", () => {
  const cars = createFieldCars(["you"]).map(car => ({ ...car, x: 0, y: 0, heading: 0 }));
  const kicked = stepFieldBalls(createFieldBalls(cars), cars, 1 / 60);
  const turned = [{ ...cars[0], heading: Math.PI / 2 }];
  const next = stepFieldBalls(kicked, turned, .1)[0];
  expect(next.x).toBeGreaterThan(kicked[0].x);
  expect(next.y).toBe(kicked[0].y);
  expect(next.vx).toBeLessThan(kicked[0].vx);
  expect(next.contacts).toBe(1);
});

test.each(["octane", "fennec", "dominus", "merc"])("Should_StartAtTheBumper_For_%s", body => {
  const cars = createFieldCars(["you"]).map(car => ({ ...car, x: 0, y: 0, heading: 0 }));
  const [ball] = createFieldBalls(cars, [], .5, new Map([["you", body]]));
  expect(ball.x - 1.2).toBeCloseTo((body === "dominus" ? 3.5 : 3) * .5);
  expect(ball.contacts).toBe(0);
});

test.each([false, true])("Should_ReturnSmoothlyAndResumePursuit_AfterShot_%s", scored => {
  let cars = createFieldCars(["you"]);
  let balls = createFieldBalls(cars).map(ball => launchFieldShot(ball, 1, scored));
  for (let step = 0; step < 60 * 30; step++) {
    cars = stepFieldCars(cars, 1 / 60, new Set(), new Map(balls.map(ball => [ball.id, ball])));
    const previous = balls[0];
    balls = stepFieldBalls(balls, cars, 1 / 60);
    expect(Math.hypot(balls[0].x - previous.x, balls[0].y - previous.y)).toBeLessThan(2);
    if (step === 71) expect(balls[0].x).toBeCloseTo(scored ? 56 : 48);
  }
  expect(balls[0].shot).toBeUndefined();
  expect(balls[0].contacts).toBeGreaterThan(2);
  expect(launchFieldShot(balls[0], 1, scored)).toBe(balls[0]);
});


test("Should_KeepEachBallActiveAndOwned_DuringFiveCarBoostedPursuit", () => {
  const ids = ["you", "nova", "echo", "blitz", "rival"];
  let cars = createFieldCars(ids), balls = createFieldBalls(cars);
  for (let step = 0; step < 60 * 120; step++) {
    const boosting = new Set(step % 180 < 21 ? ids : []);
    cars = stepFieldCars(cars, 1 / 60, boosting, new Map(balls.map(ball => [ball.id, ball])));
    balls = stepFieldBalls(balls, cars, 1 / 60, boosting);
  }
  expect(balls.map(ball => ball.id)).toEqual(cars.map(car => car.id));
  for (const ball of balls) expect(ball.contacts).toBeGreaterThan(5);
  const changed = createFieldCars(["new", ...ids.reverse()], cars);
  const retained = createFieldBalls(changed, balls);
  for (const ball of balls) expect(retained.find(other => other.id === ball.id)).toBe(ball);
});

test("Should_ReturnInsideTheField_When_ASecondShotInterruptsFlight", () => {
  const cars = createFieldCars(["you"]);
  let balls = createFieldBalls(cars).map(ball => launchFieldShot(ball, 1, true));
  for (let step = 0; step < 72; step++) balls = stepFieldBalls(balls, cars, 1 / 60);
  balls = balls.map(ball => launchFieldShot(ball, 2, false));
  for (let step = 0; step < 121; step++) {
    const before = balls[0];
    balls = stepFieldBalls(balls, cars, 1 / 60);
    expect(Math.hypot(balls[0].x - before.x, balls[0].y - before.y)).toBeLessThan(2);
  }
  expect(Math.abs(balls[0].x)).toBeLessThan(DRIVING_AREA.halfLength - 1.2);
  expect(balls[0].shot).toBeUndefined();
});
