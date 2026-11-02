import { expect, test } from "vitest";
import { createFieldCars, createFieldBalls, stepFieldBalls, stepFieldCars, launchFieldShot, finishFieldBall } from "../lib/field-motion";
import { ballContactDistance } from "../lib/stadium-track";

const cars = createFieldCars(["owner", "visitor"]).map(car => ({ ...car,
  x: car.id === "owner" ? -15 : 0, y: 0, heading: 0, targetHeading: 0, decisionIn: 20, speed: 6,
}));
const ownerBall = createFieldBalls(cars).find(ball => ball.id === "owner")!;

test.each([false, true])("Should_KickForeignBallWithoutChangingOwner_When_OnPathWithBoost_%s", boosted => {
  const ball = { ...ownerBall, x: ballContactDistance(.45), y: 0 };
  const next = stepFieldBalls([ball], cars, 1 / 60, new Set(boosted ? ["visitor"] : []))[0];
  expect(next.id).toBe("owner");
  expect(next.contacts).toBe(1);
  expect(next.vx).toBe((boosted ? 12 : 6) + 9);
  expect(next.vy).toBe(0);
});

test.each([0, .2])("Should_RespectBallCooldown_When_AnotherCarTouchesItAt_%s", sinceContact => {
  const ball = { ...ownerBall, x: ballContactDistance(.45), y: 0, sinceContact };
  const next = stepFieldBalls([ball], cars, 1 / 60)[0];
  expect(next.contacts).toBe(0);
  expect(next.vx).toBe(0);
});

test.each([-ballContactDistance(.45), ballContactDistance(.45) + 1])
("Should_NotKickForeignBall_When_BehindOrOutOfReachAt_%s", x => {
  const next = stepFieldBalls([{ ...ownerBall, x, y: 0 }], cars, 1 / 60)[0];
  expect(next.contacts).toBe(0);
});

test("Should_ContinueTowardOwnedBall_When_AForeignBallIsCloser", () => {
  const balls = createFieldBalls(cars).map(ball => ({ ...ball,
    x: ball.id === "owner" ? ballContactDistance(.45) : 0,
    y: ball.id === "owner" ? 0 : 10,
  }));
  const kicked = stepFieldBalls(balls, cars, 1 / 60);
  expect(kicked.find(ball => ball.id === "owner")!.contacts).toBe(1);
  const visitor = stepFieldCars(cars, 1 / 60, new Set(), new Map(kicked.map(ball => [ball.id, ball])))
    .find(car => car.id === "visitor")!;
  expect(visitor.targetHeading).toBeCloseTo(Math.PI / 2);
  expect(visitor.heading).toBeGreaterThan(0);
});

test.each([false, true])("Should_KeepScriptedShotUnchanged_When_ForeignCarOverlapsWithFinish_%s", finish => {
  const ball = { ...ownerBall, x: ballContactDistance(.45), y: 0 };
  const shot = finish ? finishFieldBall(ball) : launchFieldShot(ball, 1, true);
  expect(stepFieldBalls([shot], cars, .1)).toEqual(stepFieldBalls([shot], [], .1));
});
