import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Arena } from "../components/arena";
import { STADIUMS, STADIUM_IMAGES } from "../lib/garage-items";
import { stadiumPosition, stadiumRoute } from "../lib/stadium-track";

afterEach(cleanup);

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

test.each(STADIUMS)("Should_KeepAllNamesAndDrawLocalRacerLast_In_%s", stadium => {
  const { container } = render(<Arena stadium={stadium} cars={[
    { id: "you", name: "Alex", progress: .5, you: true },
    { id: "rival", name: "Sam", progress: .6, you: false },
  ]} />);
  expect([...container.querySelectorAll(".car-tag")].map(tag => tag.textContent)).toEqual(["Sam", "Alex"]);
});
