import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { Arena } from "../components/arena";
import { STADIUMS, STADIUM_IMAGES } from "../lib/garage-items";
import { fieldPose, stadiumPosition, stadiumRoute } from "../lib/stadium-track";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test.each(STADIUMS)("Should_DrawSelectedStadiumAndMoveRacer_When_ProgressChangesIn_%s", stadium => {
  const { container, rerender } = render(<Arena stadium={stadium} progress={0} />);
  expect(container.querySelector("image")?.getAttribute("href")).toBe(STADIUM_IMAGES[stadium]);
  const initial = container.querySelector("svg > g > g")?.getAttribute("transform");
  rerender(<Arena stadium={stadium} progress={1} />);
  expect(container.querySelector("svg > g > g")?.getAttribute("transform")).not.toBe(initial);
  const goal = stadiumRoute(stadium).at(-1)!;
  expect(stadiumPosition(1, stadium)).toMatchObject({ x: goal.x, y: goal.y });
  expect(stadiumPosition(-1, stadium)).toEqual(stadiumPosition(0, stadium));
  expect(stadiumPosition(2, stadium)).toEqual(stadiumPosition(1, stadium));
  expect(stadiumPosition(NaN, stadium)).toEqual(stadiumPosition(0, stadium));
  for (let step = 0; step <= 100; step++) {
    const at = stadiumPosition(step / 100, stadium);
    expect(at.x).toBeGreaterThan(0);
    expect(at.x).toBeLessThan(1400);
    expect(at.y).toBeGreaterThan(0);
    expect(at.y).toBeLessThan(900);
  }
});

test.each(STADIUMS)("Should_KeepAllNames_In_%s", stadium => {
  const { container } = render(<Arena stadium={stadium} cars={[
    { id: "you", name: "Alex", progress: .5, you: true },
    { id: "rival", name: "Sam", progress: .6, you: false },
  ]} />);
  expect([...container.querySelectorAll(".car-tag")].map(tag => tag.textContent).sort()).toEqual(["Alex", "Sam"]);
});


test("Should_KeepTheWholeCarAndBallOnThePitch_When_DrivingContinuously", () => {
  for (let time = 0; time < 120; time += .05) {
    const at = fieldPose(time);
    expect(Math.abs(at.x) + 9).toBeLessThan(41);
    expect(Math.abs(at.y) + 9).toBeLessThan(35);
    const next = fieldPose(time + .016);
    expect(Math.hypot(next.x - at.x, next.y - at.y)).toBeLessThan(.25);
    expect(Math.hypot(next.x - at.x, next.y - at.y)).toBeGreaterThan(0);
    expect(Math.cos(at.heading) * (next.x - at.x) + Math.sin(at.heading) * (next.y - at.y)).toBeGreaterThan(0);
  }
});

test("Should_SendGoalsIntoTheNetAndMissesOntoThePitch", async () => {
  const { shotBall } = await import("../lib/stadium-track");
  const pose = fieldPose(2);
  expect(shotBall(pose, 1.2, true)).toMatchObject({ x: 56, y: 0 });
  expect(shotBall(pose, 1.2, false)).toMatchObject({ x: 48, y: 15 });
  expect(shotBall(pose, .6, true).z).toBeGreaterThan(shotBall(pose, 0, true).z);
});


test("Should_AnimateASentenceShotWhileTheCarKeepsMoving", () => {
  let tick: FrameRequestCallback = () => {};
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { tick = callback; return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.spyOn(performance, "now").mockReturnValue(0);
  const { container } = render(<Arena cars={[{ id: "you", name: "Alex", progress: .2, you: true }]}
    shots={{ you: { sequence: 3, scored: true, receivedAt: 0 } }} />);
  const initial = container.querySelector("svg > g > g")!.getAttribute("transform");
  act(() => tick(600));
  const airborne = container.querySelector("svg > g > circle")!.getAttribute("cx");
  act(() => tick(1200));
  expect(container.querySelector("svg > g > g")!.getAttribute("transform")).not.toBe(initial);
  expect(container.querySelector("svg > g > circle")!.getAttribute("cx")).not.toBe(airborne);
  act(() => tick(2500));
  expect(container.querySelector("svg > g > circle")!.getAttribute("cx")).not.toBe(airborne);
});
