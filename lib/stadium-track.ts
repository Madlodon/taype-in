import type { Stadium } from "./garage-items";

// Ground-only route with enough clearance for the whole car and ball.
const ROUTE = [
  [0, -32, -12, 0], [.36, 32, -12, 0], [.49, 34, 16, 0],
  [.59, 24, 20, 0], [.78, -8, 20, 0], [1, 40, 0, 0],
] as const;

// Match the orthographic cameras in docs/mockups/assets/arena-model.py.
export function project(x: number, y: number, z: number, stadium: Stadium) {
  if (stadium === "top-down") return { x: 700 + x * 974 / 106, y: 450 - y * 492 / 70, depth: z };
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
  return { x: 700 + dot(right) * 1400 / scale, y: 450 - dot(up) * 1400 / scale, depth: dot([nx, ny, nz]) };
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

// A stable, individual route per player. Ranking and typing never change the pose.
// Analytic tangents keep steering continuous, including at the loop seam.
export function fieldPose(seconds: number, id = "preview") {
  let seed = 2166136261;
  for (const character of id) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const phase = random() * Math.PI * 2;
  const speed = (.22 + random() * .08) * (random() < .5 ? -1 : 1);
  const radiusX = 19 + random() * 7, radiusY = 10 + random() * 4;
  const centerX = (random() - .5) * 8, centerY = (random() - .5) * 4;
  const bendX = 1 + random(), bendY = .5 + random() * .5;
  const t = seconds * speed + phase;
  const dx = -radiusX * Math.sin(t) + 2 * bendX * Math.cos(2 * t + phase);
  const dy = radiusY * Math.cos(t) + 3 * bendY * Math.cos(3 * t + phase);
  return {
    x: centerX + radiusX * Math.cos(t) + bendX * Math.sin(2 * t + phase),
    y: centerY + radiusY * Math.sin(t) + bendY * Math.sin(3 * t + phase),
    heading: Math.atan2(dy * speed, dx * speed),
  };
}

// This rectangle lies entirely inside the grass in all three stadium images.
// It is also used as a final rendering guard against drawing over the stands.
export const DRIVING_AREA = { halfLength: 40, halfWidth: 25 };
export const MAX_CAR_SCALE = .5;

// A shot leaves the dribble position, travels toward the goal, then returns to play.
export function shotBall(pose: ReturnType<typeof fieldPose>, elapsed: number, scored: boolean) {
  const start = { x: pose.x + 5.7 * Math.cos(pose.heading), y: pose.y + 5.7 * Math.sin(pose.heading) };
  const fraction = Math.max(0, Math.min(1, elapsed / 1.2));
  const end = scored ? { x: 56, y: 0 } : { x: 48, y: 15 };
  return { x: start.x + (end.x - start.x) * fraction,
    y: start.y + (end.y - start.y) * fraction, z: 1.2 + Math.sin(fraction * Math.PI) * 5 };
}
