import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { FieldCar } from "../components/field-car";
import { CarBall } from "../components/car-ball";
import { BALLS, CARS, STADIUMS } from "../lib/garage-items";
import { project } from "../lib/stadium-track";

afterEach(cleanup);

test.each(STADIUMS)("Should_LoadEveryBodyAndTeamWithThirtyTwoUnclippedHeadings_In_%s", async stadium => {
  const hashes = new Set<string>();
  for (const body of CARS) for (const orange of [false, true]) {
    const path = `/sprites/cars/${stadium}/${body}-${orange ? "orange" : "blue"}.png`;
    const bytes = await readFile(`public${path}`);
    hashes.add(createHash("sha256").update(bytes).digest("hex"));
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(info).toMatchObject({ width: 1024, height: 512, channels: 4 });
    for (let frame = 0; frame < 32; frame++) {
      let visible = 0;
      let edge = 0;
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
        const alpha = data[((Math.floor(frame / 8) * 128 + y) * info.width + frame % 8 * 128 + x) * 4 + 3];
        if (alpha > 16) {
          visible++;
          if (x === 0 || y === 0 || x === 127 || y === 127) edge++;
        }
      }
      expect(visible).toBeGreaterThan(100);
      expect(edge).toBe(0);
    }
    const pose = { x: 3, y: -7, heading: 0 };
    const { container, unmount } = render(<svg><FieldCar pose={pose} stadium={stadium} body={body} orange={orange} scale={.45} /></svg>);
    const sprite = container.querySelector("svg[data-body]")!;
    expect(sprite.querySelector("image")?.getAttribute("href")).toBe(path);
    const at = project(pose.x, pose.y, 0, stadium);
    expect(Number(sprite.getAttribute("x")) + Number(sprite.getAttribute("width")) / 2).toBeCloseTo(at.x);
    expect(Number(sprite.getAttribute("y")) + Number(sprite.getAttribute("height")) / 2).toBeCloseTo(at.y);
    const expectedWidth = 12 * .45 * (stadium === "top-down" ? 974 / 106 : 1400 / (stadium === "diorama" ? 198 : 177));
    expect(Number(sprite.getAttribute("width"))).toBeCloseTo(expectedWidth);
    expect(Number(sprite.getAttribute("height"))).toBeCloseTo(stadium === "top-down" ? 12 * .45 * 492 / 70 : expectedWidth);
    unmount();
  }
  expect(hashes.size).toBe(8);
});

test.each([-Math.PI * 4, -Math.PI / 2, 0, Math.PI / 2, Math.PI * 4])("Should_WrapHeadingAndKeepExhaustIndependent_At_%s", heading => {
  const props = { pose: { x: 0, y: 0, heading }, stadium: "diorama" as const, orange: false, boost: "ion" as const };
  const { container, rerender } = render(<svg><FieldCar {...props} /></svg>);
  const before = container.querySelector("svg[data-body]")!.outerHTML;
  const frame = Number(container.querySelector("[data-heading]")!.getAttribute("data-heading"));
  expect(frame).toBe(((Math.round(heading / (2 * Math.PI) * 32) % 32) + 32) % 32);
  expect(container.querySelector(".car-boost")).toBeNull();
  rerender(<svg><FieldCar {...props} boosting /></svg>);
  expect(container.querySelector(".car-boost-ion")).not.toBeNull();
  expect(container.querySelector("svg[data-body]")!.outerHTML).toBe(before);
});

test("Should_PreserveAllGarageBallFinishesAndRadius", async () => {
  const hashes = new Set<string>();
  for (const ball of BALLS) {
    const bytes = await readFile(`public/sprites/balls/${ball}.png`);
    hashes.add(createHash("sha256").update(bytes).digest("hex"));
    expect(await sharp(bytes).metadata()).toMatchObject({ width: 256, height: 256, hasAlpha: true });
    const { container, unmount } = render(<svg><CarBall ball={ball} centered /><CarBall ball={ball} /></svg>);
    const balls = container.querySelectorAll("[data-ball]");
    expect(balls[0].getAttribute("transform")).toBeNull();
    expect(balls[1].getAttribute("transform")).toBe("translate(65 -2)");
    for (const node of balls) {
      const image = node.querySelector("image")!;
      expect(image.getAttribute("href")).toBe(`/sprites/balls/${ball}.png`);
      expect(Number(image.getAttribute("width")) * 1.8 / 2.4).toBeCloseTo(32);
    }
    unmount();
  }
  expect(hashes.size).toBe(BALLS.length);
});


test("Should_RenderDistinctCameras_ForEveryBodyAndTeam", async () => {
  for (const body of CARS) for (const team of ["blue", "orange"]) {
    const hashes = new Set<string>();
    for (const stadium of STADIUMS) {
      const bytes = await readFile(`public/sprites/cars/${stadium}/${body}-${team}.png`);
      hashes.add(createHash("sha256").update(bytes).digest("hex"));
    }
    expect(hashes.size).toBe(STADIUMS.length);
  }
});


test("Should_FacePositiveXAtZeroHeading_InTopDownView", async () => {
  // The model's orange exhaust is at negative X. This catches a flipped overhead camera.
  const { data } = await sharp("public/sprites/cars/top-down/octane-blue.png")
    .extract({ left: 0, top: 0, width: 128, height: 128 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const exhaustX: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 200 && data[i + 1] > 120 && data[i + 2] < 120 && data[i + 3] > 128) exhaustX.push((i / 4) % 128);
  }
  expect(exhaustX.length).toBeGreaterThan(0);
  expect(exhaustX.reduce((sum, x) => sum + x, 0) / exhaustX.length).toBeLessThan(64);
});
