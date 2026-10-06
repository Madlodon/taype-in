import type { Stadium } from "@/lib/garage-items";
import { project } from "@/lib/stadium-track";

type Pose = { x: number; y: number; heading: number };

// Project each vertex through the stadium camera so the car turns on the grass.
export function FieldCar({ pose, stadium, orange, scale = 1 }: {
  pose: Pose; stadium: Stadium; orange: boolean; scale?: number;
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
      depth: face.reduce((sum, index) => sum + point(...v[index] as [number,number,number]).y, 0) / 4,
    }));
  }
  const faces = [
    ...box(-3,-1.5,.7,6,3,1.25,orange ? "#ed862b" : "#328edb","body"),
    ...box(-1.8,-1.2,1.95,3.2,2.4,1.2,"#26465b","cabin"),
    ...[-2,1.6].flatMap(x => [-1.9,1.25].flatMap(y => box(x,y,.15,1.3,.65,1.2,"#15202c",`wheel-${x}-${y}`))),
  ].sort((a,b) => a.depth-b.depth);
  return <g>
    <polygon points={polygon([[-3.6,-2,0],[3.6,-2,0],[3.6,2,0],[-3.6,2,0]])} fill="#071820" opacity=".35" />
    {faces.map(face => <polygon key={face.key} points={polygon(face.vertices)} fill={face.color} stroke="#091c2b" strokeWidth=".6" />)}
    <polygon points={polygon([[2.9,-1.2,1.7],[3.1,-1.2,1.7],[3.1,1.2,1.7],[2.9,1.2,1.7]])} fill="#fff2b6" />
  </g>;
}
