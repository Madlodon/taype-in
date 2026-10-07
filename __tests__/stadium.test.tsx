import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { Arena } from "../components/arena";
import { STADIUMS, STADIUM_IMAGES } from "../lib/garage-items";
import { DRIVING_AREA, MAX_CAR_SCALE, project, fieldPose, stadiumPosition, stadiumRoute } from "../lib/stadium-track";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test.each(STADIUMS)("Should_KeepDrivingPoseStable_When_ProgressChangesIn_%s", stadium => {
  const { container, rerender } = render(<Arena stadium={stadium} progress={0} />);
  expect(container.querySelector("image")?.getAttribute("href")).toBe(STADIUM_IMAGES[stadium]);
  const initial = container.querySelector("svg > g > g > g")?.getAttribute("transform");
  rerender(<Arena stadium={stadium} progress={1} />);
  expect(container.querySelector("svg > g > g > g")?.getAttribute("transform")).toBe(initial);
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


test("Should_KeepDistinctRoutesSmoothAndInsideTheGrass", () => {
  const footprints = new Set<string>();
  for (const id of ["you", "nova", "echo", "blitz", ...Array.from({ length: 12 }, (_, i) => `player-${i}`)]) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let time = 0; time < 160; time += .1) {
      const at = fieldPose(time, id), next = fieldPose(time + .016, id);
      minX = Math.min(minX, at.x); maxX = Math.max(maxX, at.x);
      minY = Math.min(minY, at.y); maxY = Math.max(maxY, at.y);
      // Include the whole body and its ground shadow, not only the centre point.
      for (const x of [-3.6, 3.6]) for (const y of [-2, 2]) {
        expect(Math.abs(at.x + MAX_CAR_SCALE * (x * Math.cos(at.heading) - y * Math.sin(at.heading)))).toBeLessThan(DRIVING_AREA.halfLength);
        expect(Math.abs(at.y + MAX_CAR_SCALE * (x * Math.sin(at.heading) + y * Math.cos(at.heading)))).toBeLessThan(DRIVING_AREA.halfWidth);
      }
      expect(Math.abs(at.x + 5.7 * Math.cos(at.heading)) + 1.3).toBeLessThan(DRIVING_AREA.halfLength);
      expect(Math.abs(at.y + 5.7 * Math.sin(at.heading)) + 1.3).toBeLessThan(DRIVING_AREA.halfWidth);
      expect(Math.hypot(next.x - at.x, next.y - at.y)).toBeLessThan(.2);
      expect(Math.cos(at.heading) * (next.x - at.x) + Math.sin(at.heading) * (next.y - at.y)).toBeGreaterThan(0);
      const turn = Math.atan2(Math.sin(next.heading - at.heading), Math.cos(next.heading - at.heading));
      expect(Math.abs(turn)).toBeLessThan(.035);
    }
    footprints.add(`${(maxX - minX).toFixed(1)},${(maxY - minY).toFixed(1)}`);
  }
  // Different shapes and sizes, not just cars following one loop at different times.
  expect(footprints.size).toBe(16);
});

test("Should_NotJump_When_RankingChangesOrAnotherCarJoins", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const you = { id: "you", name: "Alex", progress: .1, you: true };
  const rival = { id: "rival", name: "Sam", progress: .2, you: false };
  const { container, rerender } = render(<Arena cars={[you, rival]} />);
  const pose = () => container.querySelector('[data-car-id="you"] > g > g')!.getAttribute("transform");
  const initial = pose();
  rerender(<Arena cars={[rival, { ...you, progress: .9 }, { ...rival, id: "new" }]} />);
  expect(pose()).toBe(initial);
});

test("Should_SendGoalsIntoTheNetAndMissesOntoThePitch", async () => {
  const { shotBall } = await import("../lib/stadium-track");
  const pose = fieldPose(2);
  expect(shotBall(pose, 1.2, true).x).toBeCloseTo(56);
  expect(shotBall(pose, 1.2, true).y).toBeCloseTo(0);
  expect(shotBall(pose, 1.2, false).x).toBeCloseTo(48);
  expect(shotBall(pose, 1.2, false).y).toBeCloseTo(15);
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
  const initial = container.querySelector("svg > g > g > g")!.getAttribute("transform");
  act(() => tick(600));
  const airborne = container.querySelector("[data-field-ball]")!.getAttribute("transform");
  act(() => tick(1200));
  expect(container.querySelector("svg > g > g > g")!.getAttribute("transform")).not.toBe(initial);
  expect(container.querySelector("[data-field-ball]")!.getAttribute("transform")).not.toBe(airborne);
  act(() => tick(2500));
  expect(container.querySelector("[data-field-ball]")!.getAttribute("transform")).not.toBe(airborne);
});


test.each([1.4, 100])("Should_KeepCarsSmall_When_CallerRequestsScale_%s", carScale => {
  const { container } = render(<Arena stadium="top-down" carScale={carScale} />);
  const vertices = [...container.querySelectorAll('[data-car-id="preview"] polygon')]
    .flatMap(polygon => polygon.getAttribute("points")!.split(" ").map(pair => pair.split(",").map(Number)));
  const xs = vertices.map(([x]) => x), ys = vertices.map(([, y]) => y);
  expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(40);
  expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(30);
});


test("Should_RenderTheGarageArtworkForEachDemoCarAndBall", async () => {
  const { battleCars } = await import("../components/hero-battle");
  const cars = battleCars(6000, "You");
  const { container } = render(<Arena cars={cars} />);
  for (const car of cars) {
    const element = container.querySelector(`[data-car-id="${car.id}"]`)!;
    expect(element.querySelector(`[data-body="${car.body}"] path`)).not.toBeNull();
    expect(element.querySelector(`[data-ball="${car.ball}"] circle`)).not.toBeNull();
  }
  const ids = [...container.querySelectorAll("[id]")].map(element => element.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test("Should_ShowExhaustAndGainSpeedThenStopBoostingWithoutJumping", () => {
  let tick: FrameRequestCallback = () => {};
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { tick = callback; return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.spyOn(performance, "now").mockReturnValue(0);
  const cars = [{ id: "you", name: "Alex", progress: .2, you: true }];
  const { container, rerender } = render(<Arena cars={cars} />);
  expect(container.querySelector(".car-boost")).toBeNull();
  act(() => tick(100));
  const at = () => container.querySelector('[data-car-id="you"] > g > g')!.getAttribute("transform");
  const before = at();
  rerender(<Arena cars={cars} boosts={{ you: 100 }} />);
  expect(at()).toBe(before);
  act(() => tick(200));
  expect(container.querySelector(".car-boost")).not.toBeNull();
  const boosted = fieldPose(.3, "you"); // .2 seconds driving + .1 extra from boost.
  const projected = project(boosted.x, boosted.y, 0, "diorama");
  expect(at()).toBe(`translate(${projected.x} ${projected.y})`);
  act(() => tick(600));
  expect(container.querySelector(".car-boost")).toBeNull();
  const coasting = fieldPose(.95, "you"); // .6 seconds driving + .35 boost, retained.
  const after = project(coasting.x, coasting.y, 0, "diorama");
  expect(at()).toBe(`translate(${after.x} ${after.y})`);
});
