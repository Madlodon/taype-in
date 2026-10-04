import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Car } from "../components/arena";
import { BALLS, BOOSTS, CARS } from "../lib/garage-items";

afterEach(cleanup);

test.each(BALLS)("Should_KeepBallPaintIndependent_When_TwoCarsUse_%s", (ball) => {
  const { container } = render(<svg>
    <Car x={10} y={20} boost="alpha" ball={ball} />
    <Car x={30} y={40} ball={ball} orange />
  </svg>);
  const ids = Array.from(container.querySelectorAll("[id]"), element => element.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const element of container.querySelectorAll("[fill], [stroke], [filter]")) {
    for (const attribute of ["fill", "stroke", "filter"]) {
      const reference = element.getAttribute(attribute)?.match(/^url\(#(.+)\)$/)?.[1];
      if (reference) expect(ids).toContain(reference);
    }
  }
});

test.each(BOOSTS)("Should_KeepBoostPaintIndependent_When_TwoCarsUse_%s", (boost) => {
  const { container } = render(<svg>
    <Car x={10} y={20} boost={boost} />
    <Car x={30} y={40} boost={boost} orange />
  </svg>);
  const ids = Array.from(container.querySelectorAll("[id]"), element => element.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const effect of container.querySelectorAll(".car-boost")) {
    expect(effect.querySelectorAll("path").length).toBeGreaterThan(0);
    for (const element of effect.querySelectorAll("[fill], [filter]")) {
      for (const attribute of ["fill", "filter"]) {
        const reference = element.getAttribute(attribute)?.match(/^url\(#(.+)\)$/)?.[1];
        if (reference) expect(Array.from(effect.querySelectorAll("[id]")).some(definition => definition.id === reference)).toBe(true);
      }
    }
  }
});

test.each(CARS)("Should_KeepTeamPaintIndependent_When_Two_%s_CarsShareAnArena", (body) => {
  const { container } = render(<svg>
    <Car x={10} y={20} body={body} />
    <Car x={30} y={40} body={body} orange />
  </svg>);
  const ids = Array.from(container.querySelectorAll("[id]"), (element) => element.id);
  expect(new Set(ids).size).toBe(ids.length);

  const bodies = container.querySelectorAll("[data-body]");
  const palettes = Array.from(bodies, (body) => {
    for (const element of body.querySelectorAll("[fill], [stroke]")) {
      for (const attr of ["fill", "stroke"]) {
        const reference = element.getAttribute(attr)?.match(/^url\(#(.+)\)$/)?.[1];
        if (reference) expect(Array.from(body.querySelectorAll("[id]")).some((definition) => definition.id === reference)).toBe(true);
      }
    }
    return Array.from(body.querySelectorAll("stop"), (stop) => stop.getAttribute("stop-color"));
  });
  expect(palettes[0].length).toBeGreaterThan(0);
  expect(palettes[0]).not.toEqual(palettes[1]);
});
