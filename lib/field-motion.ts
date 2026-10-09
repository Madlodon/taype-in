import { ballContactDistance, shotBall, DRIVING_AREA, MAX_CAR_SCALE } from "./stadium-track";

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
  detourIn?: number;
};

// Leave room for the largest car and its ball, even during a turn.
const LIMIT_X = DRIVING_AREA.halfLength - 7.5;
const LIMIT_Y = DRIVING_AREA.halfWidth - 7.5;
const TURN_SPEED = 1.6;

// Two largest body half-diagonals (4 units each), plus six units for kicks/turns.
// Race: 9.6 world units; homepage (capped at .5): 10 units between centres.
export function fieldClearance(scale = .45): number {
  return 6 + 8 * Math.max(.1, Math.min(scale, MAX_CAR_SCALE));
}

function random(state: { seed: number }): number {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

// Keep existing poses when the visible ranking changes. New cars start in free space.
export function createFieldCars(ids: readonly string[], previous: readonly FieldMotion[] = [], scale = .45): FieldMotion[] {
  const cars = previous.filter(car => ids.includes(car.id));
  for (const id of [...ids].sort()) {
    if (cars.some(car => car.id === id)) continue;
    let seed = 2166136261;
    for (const character of id) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
    const state = { seed };
    let x = 0, y = 0, clearance = -1;
    for (let attempt = 0; attempt < 128; attempt++) {
      const candidateX = (random(state) - .5) * (LIMIT_X - 2) * 2;
      const candidateY = (random(state) - .5) * (LIMIT_Y - 2) * 2;
      const distance = Math.min(...cars.map(car => Math.hypot(car.x - candidateX, car.y - candidateY)));
      if (distance > clearance) { x = candidateX; y = candidateY; clearance = distance; }
      if (clearance >= fieldClearance(scale) + 4) break;
    }
    const heading = random(state) * Math.PI * 2;
    const speed = 5 + random(state) * 2;
    const decisionIn = 2 + random(state) * 2;
    cars.push({ id, x, y, heading, targetHeading: heading, speed, decisionIn, seed: state.seed, edgeTurn: false });
  }
  return cars;
}

// Optional pursuit targets leave spawn placement and car spacing independent (#182).
// Call with short time steps so avoidance also works at low rendering frame rates.
export function stepFieldCars(cars: readonly FieldMotion[], seconds: number, boosting: ReadonlySet<string> = new Set(), pursuit: ReadonlyMap<string, FieldBall> = new Map(), scale = .45): FieldMotion[] {
  const clearance = fieldClearance(scale);
  return cars.map(car => {
    const next = { ...car, decisionIn: car.decisionIn - seconds, detourIn: Math.max(0, (car.detourIn ?? 0) - seconds) };
    if (next.decisionIn <= 0) {
      const choice = random(next);
      const turn = choice < .25 ? 1 : choice < .5 ? -1 : 0;
      const target = car.heading + turn * (.6 + random(next) * .7);
      if (!car.edgeTurn) next.targetHeading = target;
      next.decisionIn += 2 + random(next) * 2;
    }

    const ball = pursuit.get(car.id);
    if (ball && !ball.shot && !car.edgeTurn && !next.detourIn) {
      next.targetHeading = Math.atan2(ball.y - car.y, ball.x - car.x);
    }

    // Avoid obstacles along the pursuit path, even while turning back to a ball.
    const travelHeading = ball && !ball.shot ? next.targetHeading : car.heading;
    const forwardX = Math.cos(travelHeading), forwardY = Math.sin(travelHeading);
    let speed = car.speed * (boosting.has(car.id) ? 2 : 1);
    let nearest = Infinity;
    for (const other of cars) {
      if (other.id === car.id) continue;
      const dx = other.x - car.x, dy = other.y - car.y;
      const distance = Math.hypot(dx, dy);
      const ahead = dx * forwardX + dy * forwardY;
      const side = forwardX * dy - forwardY * dx;
      if ((ahead <= 0 && distance > clearance + 2) || distance > clearance + 5 || Math.abs(side) > clearance) continue;
      if (distance < nearest && !next.detourIn) {
        nearest = distance;
        // Both drivers bear right in a head-on encounter.
        const bearing = Math.atan2(dy, dx);
        const turn = Math.PI / 2 + Math.max(0, (clearance + 3 - distance) / 3);
        const right = bearing - turn, left = bearing + turn;
        const room = (heading: number) => Math.min(
          LIMIT_X - Math.abs(car.x + Math.cos(heading) * 6),
          LIMIT_Y - Math.abs(car.y + Math.sin(heading) * 6));
        next.targetHeading = room(right) < 1 && room(left) > room(right) ? left : right;
      }
    }

    // Hold the passing direction briefly so pursuit cannot reverse it every frame.
    if (nearest < Infinity && ball && !ball.shot) next.detourIn = .8;

    // Finish an inward turn even when avoidance temporarily takes us away from a ball.
    const edgeMargin = ball && !ball.shot ? .5 : 2;
    const edgeLookahead = ball && !ball.shot ? .25 : 1.4;
    const edgeHeading = nearest < Infinity ? next.targetHeading : travelHeading;
    if (!car.edgeTurn && (Math.abs(car.x + Math.cos(edgeHeading) * speed * edgeLookahead) > LIMIT_X - edgeMargin ||
        Math.abs(car.y + Math.sin(edgeHeading) * speed * edgeLookahead) > LIMIT_Y - edgeMargin)) {
      next.targetHeading = Math.atan2(-car.y, -car.x);
      next.edgeTurn = true;
    }
    // Avoidance must not keep pointing through a wall while the boundary brake is on.
    let targetX = Math.cos(next.targetHeading), targetY = Math.sin(next.targetHeading);
    if (Math.abs(car.x) > LIMIT_X - 3 && targetX * car.x > 0) targetX *= -1;
    if (Math.abs(car.y) > LIMIT_Y - 3 && targetY * car.y > 0) targetY *= -1;
    next.targetHeading = car.heading + Math.atan2(
      Math.sin(Math.atan2(targetY, targetX) - car.heading), Math.cos(Math.atan2(targetY, targetX) - car.heading));
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
        const distance = Math.hypot(dx, dy);
        const closing = (dx * vx + dy * vy) / distance;
        speed = Math.min(speed, Math.max(0, (distance - clearance) * 2 / closing));
      }
    }
    if (ball && !ball.shot) {
      // Turn toward a missed ball before advancing, instead of orbiting it forever.
      const bearing = next.targetHeading - next.heading;
      speed *= Math.max(0, Math.cos(bearing)) ** 4;
    }
    next.x += vx * speed * seconds;
    next.y += vy * speed * seconds;
    return next;
  });
}


export type FieldBall = {
  id: string; x: number; y: number; z: number;
  vx: number; vy: number; spin: number; sinceContact: number; contacts: number;
  shot?: { sequence: number; scored: boolean; elapsed: number; x: number; y: number; z: number; returnX: number; returnY: number };
  shotSequence?: number;
};

export function createFieldBalls(cars: readonly FieldMotion[], previous: readonly FieldBall[] = [],
  scale = .45, bodies: ReadonlyMap<string, string> = new Map()): FieldBall[] {
  return cars.map(car => previous.find(ball => ball.id === car.id) ?? {
    id: car.id, x: car.x + ballContactDistance(scale, bodies.get(car.id)) * Math.cos(car.heading),
    y: car.y + ballContactDistance(scale, bodies.get(car.id)) * Math.sin(car.heading),
    z: 1.2, vx: 0, vy: 0, spin: 0, sinceContact: Infinity, contacts: 0,
  });
}

export function launchFieldShot(ball: FieldBall, sequence: number, scored: boolean): FieldBall {
  if (ball.shotSequence === sequence) return ball;
  return { ...ball, vx: 0, vy: 0, sinceContact: Infinity, shotSequence: sequence,
    shot: { sequence, scored, elapsed: 0, x: ball.x, y: ball.y, z: ball.z,
      returnX: ball.shot?.returnX ?? ball.x, returnY: ball.shot?.returnY ?? ball.y } };
}

// Ball integration never uses the car heading except at a real bumper contact.
export function stepFieldBalls(balls: readonly FieldBall[], cars: readonly FieldMotion[], seconds: number,
  boosting: ReadonlySet<string> = new Set(), scale = .45, bodies: ReadonlyMap<string, string> = new Map()): FieldBall[] {
  return balls.map(ball => {
    const next = { ...ball, sinceContact: ball.sinceContact + seconds };
    if (ball.shot) {
      const elapsed = Math.min(2, ball.shot.elapsed + seconds);
      const shot = { ...ball.shot, elapsed };
      const flight = shotBall({ x: shot.x, y: shot.y, heading: 0 }, Math.min(elapsed, 1.2), shot.scored, 0);
      const recovery = Math.max(0, (elapsed - 1.2) / .8);
      // Return to a fixed ground position, then let the driver find the ball again.
      return { ...next, x: flight.x + (shot.returnX - flight.x) * recovery,
        y: flight.y + (shot.returnY - flight.y) * recovery, z: elapsed > 1.2 ? 1.2 : flight.z + (shot.z - 1.2) * (1 - elapsed / 1.2),
        shot: elapsed < 2 ? shot : undefined };
    }
    const decay = Math.exp(-1.5 * seconds);
    next.x += ball.vx * (1 - decay) / 1.5;
    next.y += ball.vy * (1 - decay) / 1.5;
    next.vx *= decay; next.vy *= decay;
    // Reflect at an inset boundary: the ball remains reachable from the driving area.
    for (const [axis, velocity, limit] of [["x", "vx", LIMIT_X - 1], ["y", "vy", LIMIT_Y - 1]] as const) {
      if (Math.abs(next[axis]) > limit) {
        next[axis] = Math.sign(next[axis]) * (2 * limit - Math.abs(next[axis]));
        next[velocity] *= -.65;
      }
    }
    const car = cars.find(car => car.id === ball.id)!;
    const dx = next.x - car.x, dy = next.y - car.y;
    const distance = Math.hypot(dx, dy);
    const ahead = dx * Math.cos(car.heading) + dy * Math.sin(car.heading);
    const side = -dx * Math.sin(car.heading) + dy * Math.cos(car.heading);
    const contact = ballContactDistance(scale, bodies.get(car.id));
    if (next.sinceContact > .25 && ahead > 0 && Math.abs(side) < .7 && distance <= contact + .25) {
      const speed = car.speed * (boosting.has(car.id) ? 2 : 1) + 9;
      next.vx = Math.cos(car.heading) * speed;
      next.vy = Math.sin(car.heading) * speed;
      next.sinceContact = 0;
      next.contacts++;
    }
    next.z = 1.2 + (next.sinceContact < .6 ? Math.sin(next.sinceContact / .6 * Math.PI) * .8 : 0);
    next.spin += Math.hypot(next.x - ball.x, next.y - ball.y) * 180 / (Math.PI * 1.2);
    return next;
  });
}
