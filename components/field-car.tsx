import { CarBoost } from "@/components/car-boost";
import type { Loadout, Stadium } from "@/lib/garage-items";
import { project } from "@/lib/stadium-track";

type Pose = { x: number; y: number; heading: number };

// Match the Blender camera and select the heading without rotating the sprite lighting.
export function FieldCar({ pose, stadium, orange, scale = 1, body = "octane", boost = "standard", boosting = false }: {
  pose: Pose; stadium: Stadium; orange: boolean; scale?: number; body?: Loadout["car"]; boost?: Loadout["boost"]; boosting?: boolean;
}) {
  const point = (x: number, y: number, z: number) => project(
    pose.x + scale * (x * Math.cos(pose.heading) - y * Math.sin(pose.heading)),
    pose.y + scale * (x * Math.sin(pose.heading) + y * Math.cos(pose.heading)), z * scale, stadium);
  const polygon = (vertices: number[][]) => vertices.map(([x, y, z]) => {
    const p = point(x, y, z); return `${p.x},${p.y}`;
  }).join(" ");
  const unit = (body === "dominus" ? 7 : 6) / 100;
  const at = project(pose.x, pose.y, 0, stadium);
  const frame = ((Math.round(pose.heading / (Math.PI * 2) * 32) % 32) + 32) % 32;
  const width = 12 * scale * (stadium === "top-down" ? 974 / 106 : 1400 / (stadium === "diorama" ? 198 : 177));
  const height = stadium === "top-down" ? 12 * scale * 492 / 70 : width;
  const exhaust = point(0, 0, .8), exhaustX = point(unit, 0, .8), exhaustY = point(0, unit, .8);
  return <g data-field-body={body} data-boosting={boosting}>
    {boosting && <g transform={`matrix(${exhaustX.x-exhaust.x} ${exhaustX.y-exhaust.y} ${exhaustY.x-exhaust.x} ${exhaustY.y-exhaust.y} ${exhaust.x} ${exhaust.y})`}>
      <CarBoost boost={boost} />
    </g>}
    <polygon points={polygon([[-3.6,-2,0],[3.6,-2,0],[3.6,2,0],[-3.6,2,0]])} fill="#071820" opacity=".35" />
    <svg data-body={body} data-heading={frame} x={at.x - width / 2} y={at.y - height / 2}
      width={width} height={height} viewBox={`${frame % 8 * 128} ${Math.floor(frame / 8) * 128} 128 128`}
      preserveAspectRatio="none" overflow="hidden">
      <image href={`/sprites/cars/${stadium}/${body}-${orange ? "orange" : "blue"}.png`} width="1024" height="512" />
    </svg>
  </g>;
}
