import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Car } from "../components/arena";

afterEach(cleanup);

test("Should_KeepTeamPaintIndependent_When_MultipleCarsShareAnArena", () => {
  const { container } = render(<svg>
    <Car x={10} y={20} />
    <Car x={30} y={40} orange />
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
