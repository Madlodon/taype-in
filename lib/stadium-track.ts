import type { Stadium } from "./garage-items";

// Ground-only route with enough clearance for the whole car and ball.
const ROUTE = [
  [0, -32, -12, 0], [.36, 32, -12, 0], [.49, 34, 16, 0],
  [.59, 24, 20, 0], [.78, -8, 20, 0], [1, 40, 0, 0],
] as const;

// Match the orthographic cameras in docs/mockups/assets/arena-model.py.
export function project(x: number, y: number, z: number, stadium: Stadium) {
  if (stadium === "top-down") return { x: 700 + x * 974 / 106, y: 450 - y * 492 / 70 };
  const [camera, target, scale] = stadium === "diorama"
    ? [[115, -140, 135], [0, 0, 7], 198] as const
    : [[5, -170, 85], [0, 3, 7], 177] as const;
  const direction = camera.map((value, axis) => value - target[axis]);
  const length = Math.hypot(...direction);
  const [nx, ny, nz] = direction.map(value => value / length);
  const horizontal = Math.hypot(nx, ny);
  const right = [-ny / horizontal, nx / horizontal, 0];
  const up = [-nz * right[1], nz * right[0], nx * right[1] - ny * right[0]];
  const point = [x - target[0], y - target[1], z - target[2]];
  const dot = (vector: number[]) => point.reduce((sum, value, axis) => sum + value * vector[axis], 0);
  return { x: 700 + dot(right) * 1400 / scale, y: 450 - dot(up) * 1400 / scale };
}

export function stadiumRoute(stadium: Stadium) {
  return ROUTE.map(([progress, x, y, z]) => ({ progress, ...project(x, y, z, stadium) }));
}

export function stadiumPosition(progress: number, stadium: Stadium) {
  const points = stadiumRoute(stadium);
  const value = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const end = points.findIndex((point, index) => index > 0 && value <= point.progress);
  const a = points[end - 1], b = points[end];
  const fraction = (value - a.progress) / (b.progress - a.progress);
  return {
    x: a.x + (b.x - a.x) * fraction,
    y: a.y + (b.y - a.y) * fraction,
    angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI,
  };
}

// Smooth closed patrol. Heading follows the tangent instead of rotating a flat sprite.
export function fieldPose(seconds: number, phase = 0) {
  const t = seconds * .42 + phase * Math.PI * 2;
  return { x: 30 * Math.cos(t), y: 17 * Math.sin(t),
    heading: Math.atan2(17 * Math.cos(t), -30 * Math.sin(t)) };
}
