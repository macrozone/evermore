export interface MovementConfig {
  speed: number;
  acceleration: number;
  deceleration: number;
  cornerTolerance: number;
}
export const DEFAULT_MOVEMENT: Readonly<MovementConfig> = {
  speed: 4, acceleration: 60, deceleration: 80, cornerTolerance: 0.25,
};
export interface MovementPosition { x: number; y: number; z: number }
export interface MovementInput { x: number; y: number }
export type Facing = "north" | "northeast" | "east" | "southeast" | "south" | "southwest" | "west" | "northwest";
export interface MovementState extends MovementPosition {
  vx: number; vy: number; facing: Facing; walkTime: number; moving: boolean;
}
/** Returns the reachable feet height, or null if the whole footprint is blocked. */
export type MovementCollision = (position: MovementPosition) => number | null;
export const MOVEMENT_STEP = 1 / 60;

export function createMovement(position: MovementPosition): MovementState {
  return { ...position, vx: 0, vy: 0, facing: "south", walkTime: 0, moving: false };
}
const directions: Facing[] = ["east", "southeast", "south", "southwest", "west", "northwest", "north", "northeast"];

function moveAxis(state: MovementState, axis: "x" | "y", distance: number, collision: MovementCollision) {
  const candidate = { x: state.x, y: state.y, z: state.z };
  candidate[axis] += distance;
  const height = collision(candidate);
  if (height === null) return false;
  state[axis] = candidate[axis];
  state.z = height;
  return true;
}

/** Sweep sideways toward a nearby opening, including for diagonal input. */
function correctCorner(state: MovementState, axis: "x" | "y", distance: number, tolerance: number, collision: MovementCollision) {
  const side = axis === "x" ? "y" : "x";
  for (let offset = 0.025; offset <= tolerance + 1e-9; offset += 0.025) {
    for (const sign of [-1, 1]) {
      const target = { x: state.x, y: state.y, z: state.z };
      target[axis] += distance;
      target[side] += offset * sign;
      if (collision(target) === null) continue;
      // Walk toward the opening, checking the entire correction path.
      let clear = true;
      for (let along = 0.025; along <= offset + 1e-9; along += 0.025) {
        const probe = { x: state.x, y: state.y, z: state.z };
        probe[side] += along * sign;
        if (collision(probe) === null) { clear = false; break; }
      }
      if (clear && moveAxis(state, side, offset * sign, collision)) {
        // Complete the forward step in the same sweep. Otherwise an opposing
        // diagonal component undoes the correction and oscillates at the edge.
        moveAxis(state, axis, distance, collision);
        return true;
      }
    }
  }
  return false;
}

export function stepMovement(state: MovementState, input: MovementInput, config: MovementConfig, collision: MovementCollision): void {
  const magnitude = Math.hypot(input.x, input.y);
  const x = magnitude > 0 ? input.x / Math.max(1, magnitude) : 0;
  const y = magnitude > 0 ? input.y / Math.max(1, magnitude) : 0;
  if (magnitude > 0) state.facing = directions[(Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8]!;
  const tx = x * config.speed;
  const ty = y * config.speed;
  const difference = Math.hypot(tx - state.vx, ty - state.vy);
  const rate = magnitude > 0 ? config.acceleration : config.deceleration;
  const blend = difference === 0 ? 1 : Math.min(1, Math.max(0, rate) * MOVEMENT_STEP / difference);
  state.vx += (tx - state.vx) * blend;
  state.vy += (ty - state.vy) * blend;
  const dx = state.vx * MOVEMENT_STEP;
  const dy = state.vy * MOVEMENT_STEP;
  const beforeX = state.x;
  const beforeY = state.y;
  // Bound collision sweeps even when experimental speed is very high.
  const parts = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.05));
  for (let part = 0; part < parts; part++) {
    const movedX = moveAxis(state, "x", dx / parts, collision);
    const movedY = moveAxis(state, "y", dy / parts, collision);
    // Ordinary wall sliding takes priority. Correct a diagonal only when both
    // axes are blocked, so correction cannot fight the requested tangent.
    const correctedX = !movedX && x !== 0 && (y === 0 || !movedY)
      && correctCorner(state, "x", dx / parts, config.cornerTolerance, collision);
    if (!correctedX && !movedY && y !== 0 && (x === 0 || !movedX)) {
      correctCorner(state, "y", dy / parts, config.cornerTolerance, collision);
    }
  }
  state.moving = Math.hypot(state.x - beforeX, state.y - beforeY) > 1e-8;
  state.walkTime = state.moving ? state.walkTime + MOVEMENT_STEP : 0;
}
export function movementFrame(state: MovementState): number {
  return state.moving ? Math.floor(state.walkTime * 10) % 4 : 0;
}

/** Retains fractional time; pauses never cause an unbounded catch-up loop. */
export function createMovementClock() {
  let accumulator = 0;
  return (elapsed: number, step: () => void) => {
    accumulator += Math.max(0, Math.min(Number.isFinite(elapsed) ? elapsed : 0, 0.25));
    while (accumulator + 1e-10 >= MOVEMENT_STEP) {
      step();
      accumulator -= MOVEMENT_STEP;
    }
  };
}
