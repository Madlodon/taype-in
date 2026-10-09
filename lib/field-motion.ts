import { DRIVING_AREA } from "./stadium-track";

export type FieldMotion = {
  id: string;
  x: number;
  y: number;
  heading: number;
  targetHeading: number;
  speed: number;
  decisionIn: number;
  seed: number;
  edgeTurn: boolean;
};

// Leave room for the largest car and its ball, even during a turn.
const LIMIT_X = DRIVING_AREA.halfLength - 7.5;
const LIMIT_Y = DRIVING_AREA.halfWidth - 7.5;
const TURN_SPEED = 1.6;

function random(state: { seed: number }): number {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

// Keep existing poses when the visible ranking changes. New cars start in free space.
export function createFieldCars(ids: readonly string[], previous: readonly FieldMotion[] = []): FieldMotion[] {
  const cars = previous.filter(car => ids.includes(car.id));
  for (const id of [...ids].sort()) {
    if (cars.some(car => car.id === id)) continue;
    let seed = 2166136261;
    for (const character of id) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
    const state = { seed };
    let x = 0, y = 0, clearance = -1;
    for (let attempt = 0; attempt < 64; attempt++) {
      const candidateX = (random(state) - .5) * 52;
      const candidateY = (random(state) - .5) * 24;
      const distance = Math.min(...cars.map(car => Math.hypot(car.x - candidateX, car.y - candidateY)));
      if (distance > clearance) { x = candidateX; y = candidateY; clearance = distance; }
      if (clearance >= 10) break;
    }
    const heading = random(state) * Math.PI * 2;
    const speed = 5 + random(state) * 2;
    const decisionIn = 2 + random(state) * 2;
    cars.push({ id, x, y, heading, targetHeading: heading, speed, decisionIn, seed: state.seed, edgeTurn: false });
  }
  return cars;
}

// Call with short time steps so avoidance also works at low rendering frame rates.
export function stepFieldCars(cars: readonly FieldMotion[], seconds: number, boosting: ReadonlySet<string> = new Set()): FieldMotion[] {
  return cars.map(car => {
    const next = { ...car, decisionIn: car.decisionIn - seconds };
    if (next.decisionIn <= 0) {
      const choice = random(next);
      const turn = choice < .25 ? 1 : choice < .5 ? -1 : 0;
      const target = car.heading + turn * (.6 + random(next) * .7);
      if (!car.edgeTurn) next.targetHeading = target;
      next.decisionIn += 2 + random(next) * 2;
    }

    const forwardX = Math.cos(car.heading), forwardY = Math.sin(car.heading);
    let speed = car.speed * (boosting.has(car.id) ? 2 : 1);
    let nearest = Infinity;
    for (const other of cars) {
      if (other.id === car.id) continue;
      const dx = other.x - car.x, dy = other.y - car.y;
      const distance = Math.hypot(dx, dy);
      const ahead = dx * forwardX + dy * forwardY;
      const side = forwardX * dy - forwardY * dx;
      if (ahead <= 0 || distance > 13 || Math.abs(side) > 5) continue;
      if (distance < nearest) {
        nearest = distance;
        // Both drivers bear right in a head-on encounter.
        if (!car.edgeTurn) next.targetHeading = car.heading + (side > .1 ? -1 : side < -.1 ? 1 : -1) * 1.2;
      }
      speed = Math.min(speed, car.speed * Math.max(.08, Math.min(1, (distance - 4.5) / 6)));
    }

    if (!car.edgeTurn && (Math.abs(car.x + forwardX * speed * 1.4) > LIMIT_X - 2 ||
        Math.abs(car.y + forwardY * speed * 1.4) > LIMIT_Y - 2)) {
      next.targetHeading = Math.atan2(-car.y, -car.x);
      next.edgeTurn = true;
    }
    const angle = Math.atan2(Math.sin(next.targetHeading - car.heading), Math.cos(next.targetHeading - car.heading));
    next.heading = car.heading + Math.max(-TURN_SPEED * seconds, Math.min(TURN_SPEED * seconds, angle));
    if (Math.abs(angle) < TURN_SPEED * seconds) next.edgeTurn = false;
    const vx = Math.cos(next.heading), vy = Math.sin(next.heading);
    // Brake before the boundary instead of clamping the pose or teleporting inward.
    const roomX = Math.abs(vx) < 1e-8 ? Infinity : (LIMIT_X - Math.sign(vx) * car.x) / Math.abs(vx);
    const roomY = Math.abs(vy) < 1e-8 ? Infinity : (LIMIT_Y - Math.sign(vy) * car.y) / Math.abs(vy);
    speed = Math.max(0, Math.min(speed, roomX * 2, roomY * 2));
    // Edge steering can override avoidance; still leave braking room for a neighbour.
    for (const other of cars) {
      if (other.id === car.id) continue;
      const dx = other.x - car.x, dy = other.y - car.y;
      if (dx * vx + dy * vy > 0) {
        speed = Math.min(speed, Math.max(0, (Math.hypot(dx, dy) - 4.3) * 2));
      }
    }
    next.x += vx * speed * seconds;
    next.y += vy * speed * seconds;
    return next;
  });
}
