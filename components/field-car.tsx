import { CarBody } from "@/components/car-body";
import { CarBoost } from "@/components/car-boost";
import type { Loadout, Stadium } from "@/lib/garage-items";
import { project } from "@/lib/stadium-track";

type Pose = { x: number; y: number; heading: number };

// Project each vertex through the stadium camera so the car turns on the grass.
export function FieldCar({ pose, stadium, orange, scale = 1, body = "octane", boost = "standard", boosting = false }: {
  pose: Pose; stadium: Stadium; orange: boolean; scale?: number; body?: Loadout["car"]; boost?: Loadout["boost"]; boosting?: boolean;
}) {
  const point = (x: number, y: number, z: number) => project(
    pose.x + scale * (x * Math.cos(pose.heading) - y * Math.sin(pose.heading)),
    pose.y + scale * (x * Math.sin(pose.heading) + y * Math.cos(pose.heading)), z * scale, stadium);
  const polygon = (vertices: number[][]) => vertices.map(([x, y, z]) => {
    const p = point(x, y, z); return `${p.x},${p.y}`;
  }).join(" ");
  function box(x: number, y: number, z: number, length: number, width: number, height: number, color: string, key: string) {
    const v = [[x,y,z],[x+length,y,z],[x+length,y+width,z],[x,y+width,z],
      [x,y,z+height],[x+length,y,z+height],[x+length,y+width,z+height],[x,y+width,z+height]];
    return [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]].map((face, i) => ({
      key: `${key}-${i}`, vertices: face.map(index => v[index]), color,
      depth: face.reduce((sum, index) => sum + point(...v[index] as [number,number,number]).depth, 0) / 4,
    }));
  }
  const model = {
    octane: { length: 6, cabinX: -1.4, cabinLength: 2.8, roof: 2.8 },
    fennec: { length: 6, cabinX: -2.3, cabinLength: 3.7, roof: 3 },
    dominus: { length: 7, cabinX: -1.8, cabinLength: 2.9, roof: 2.5 },
    merc: { length: 6, cabinX: -2.5, cabinLength: 4.8, roof: 3.5 },
  }[body];
  const unit = model.length / 100;
  // Place the existing garage artwork on upright sides of the 3D body.
  const side = (y: number) => {
    const origin = point(0, y, 25 * unit);
    const right = point(unit, y, 25 * unit), down = point(0, y, 24 * unit);
    return `matrix(${right.x-origin.x} ${right.y-origin.y} ${down.x-origin.x} ${down.y-origin.y} ${origin.x} ${origin.y})`;
  };
  const exhaust = point(0, 0, .8), exhaustX = point(unit, 0, .8), exhaustY = point(0, unit, .8);
  const faces = [
    ...box(-model.length/2,-1.5,.7,model.length,3,1.25,orange ? "#ed862b" : "#328edb","body"),
    ...box(model.cabinX,-1.2,1.95,model.cabinLength,2.4,model.roof-1.95,"#26465b","cabin"),
    ...[-2,1.6].flatMap(x => [-1.9,1.25].flatMap(y => box(x,y,.15,1.3,.65,1.2,"#15202c",`wheel-${x}-${y}`))),
  ].sort((a,b) => a.depth-b.depth);
  const surfaces = faces.map(face => ({ depth: face.depth, key: face.key, element:
    <polygon points={polygon(face.vertices)} fill={face.color} stroke="#091c2b" strokeWidth=".6" /> }));
  for (const y of [-1.9, 1.9]) surfaces.push({ depth: point(0, y, 1.5).depth, key: `side-${y}`,
    element: <g transform={side(y)}><CarBody body={body} orange={orange} /></g> });
  surfaces.sort((a, b) => a.depth - b.depth);
  return <g data-field-body={body} data-boosting={boosting}>
    {boosting && <g transform={`matrix(${exhaustX.x-exhaust.x} ${exhaustX.y-exhaust.y} ${exhaustY.x-exhaust.x} ${exhaustY.y-exhaust.y} ${exhaust.x} ${exhaust.y})`}>
      <CarBoost boost={boost} />
    </g>}
    <polygon points={polygon([[-3.6,-2,0],[3.6,-2,0],[3.6,2,0],[-3.6,2,0]])} fill="#071820" opacity=".35" />
    {surfaces.map(surface => <g key={surface.key}>{surface.element}</g>)}
    <polygon points={polygon([[2.9,-1.2,1.7],[3.1,-1.2,1.7],[3.1,1.2,1.7],[2.9,1.2,1.7]])} fill="#fff2b6" />
  </g>;
}
