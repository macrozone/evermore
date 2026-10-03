import { describe, expect, it } from "vitest";
import { createMovement, createMovementClock, DEFAULT_MOVEMENT, movementFrame, MOVEMENT_STEP, stepMovement, type MovementCollision, type MovementInput } from "./movement";

const instant = { ...DEFAULT_MOVEMENT, acceleration: 10000, deceleration: 10000 };
const free: MovementCollision = (p) => p.z;
function run(input: MovementInput, collision = free, config = instant, steps = 60, start = { x: 0, y: 0, z: 0 }) {
  const state = createMovement(start);
  for (let i = 0; i < steps; i++) stepMovement(state, input, config, collision);
  return state;
}
describe("movement", () => {
  it("normalizes diagonal speed and keeps subpixel positions", () => {
    const straight = run({ x: 1, y: 0 });
    const diagonal = run({ x: 1, y: 1 });
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(straight.x);
    expect(diagonal.x).not.toBe(Math.round(diagonal.x));
    expect(diagonal.facing).toBe("southeast");
  });
  it("accelerates quickly and brakes to rest while retaining facing", () => {
    const state = createMovement({ x: 0, y: 0, z: 0 });
    stepMovement(state, { x: -1, y: 0 }, DEFAULT_MOVEMENT, free);
    expect(state.vx).toBe(-1);
    for (let i = 0; i < 10; i++) stepMovement(state, { x: -1, y: 0 }, DEFAULT_MOVEMENT, free);
    expect(state.vx).toBe(-4);
    for (let i = 0; i < 10; i++) stepMovement(state, { x: 0, y: 0 }, DEFAULT_MOVEMENT, free);
    expect(state.vx).toBe(0);
    expect(state.facing).toBe("west");
    expect(movementFrame(state)).toBe(0);
  });
  it("blocks walls and slides tangentially", () => {
    const wall: MovementCollision = (p) => p.x > 1 ? null : 0;
    expect(run({ x: 1, y: 0 }, wall).x).toBeLessThanOrEqual(1);
    const slide = run({ x: 1, y: 1 }, wall);
    expect(slide.x).toBeLessThanOrEqual(1);
    expect(slide.y).toBeGreaterThan(2);
  });
  it("nudges past small corners but not beyond the tolerance", () => {
    const corner: MovementCollision = (p) => p.x > 1 && p.y < 0.2 ? null : 0;
    expect(run({ x: 1, y: 0 }, corner).x).toBeGreaterThan(2);
    expect(run({ x: 1, y: 0 }, corner, { ...instant, cornerTolerance: 0.1 }).x).toBeLessThanOrEqual(1);
  });
  it("does not cut diagonally through a corner or tunnel at high speed", () => {
    const corner: MovementCollision = (p) => p.x > 1 || p.y > 1 ? null : 0;
    const state = run({ x: 1, y: 1 }, corner);
    expect(state.x).toBeLessThanOrEqual(1);
    expect(state.y).toBeLessThanOrEqual(1);
    const thinWall: MovementCollision = (p) => p.x >= 1 && p.x <= 1.1 ? null : 0;
    expect(run({ x: 1, y: 0 }, thinWall, { ...instant, speed: 100 }).x).toBeLessThan(1);
  });
  it("does not correct through a blocked sideways path", () => {
    const wall: MovementCollision = (p) => p.x > 1 && Math.abs(p.y) < 0.15 || p.y > 0.05 && p.y < 0.1 || p.y < -0.05 && p.y > -0.1 ? null : 0;
    expect(run({ x: 1, y: 0 }, wall).x).toBeLessThanOrEqual(1);
  });
  it("produces identical simulation at different rendering rates", () => {
    function simulated(hz: number) {
      const state = createMovement({ x: 0, y: 0, z: 0 });
      const clock = createMovementClock();
      for (let i = 0; i < hz; i++) clock(1 / hz, () => stepMovement(state, { x: 1, y: 1 }, DEFAULT_MOVEMENT, free));
      return state;
    }
    expect(simulated(30)).toEqual(simulated(144));
  });
  it("caps pause catch-up and retains fractional time", () => {
    const clock = createMovementClock();
    let ticks = 0;
    clock(MOVEMENT_STEP / 2, () => ticks++);
    expect(ticks).toBe(0);
    clock(MOVEMENT_STEP / 2, () => ticks++);
    expect(ticks).toBe(1);
    clock(10, () => ticks++);
    expect(ticks).toBe(16);
  });
});
