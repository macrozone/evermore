import { createMovement, DEFAULT_MOVEMENT, stepMovement } from "@evermore/core";
import { createMeadowHouseWorld, M, World, box } from "@evermore/world";
import { describe, expect, it } from "vitest";
import { cameraMovement, followBlend, nearestVoxelPosition, voxelMovementFloor } from "./player-model";

function walk(world: World, state: ReturnType<typeof createMovement>, x: number, y: number, frames: number) {
  for (let frame = 0; frame < frames; frame++) stepMovement(state, { x, y }, DEFAULT_MOVEMENT, (position) => voxelMovementFloor(world, position));
}

describe("voxel player collision", () => {
  it("only climbs one-cell rises through explicit stairs or bridge approaches", () => {
    const world = new World({ width: 8, depth: 8, height: 12 });
    world.fill(box(0, 0, 0, 8, 8, 3), M.grass);
    world.setCell(3, 3, 3, M.stone);
    expect(voxelMovementFloor(world, { x: 2.8, y: 3.5, z: 3 })).toBeNull();
    world.setCell(3, 3, 3, M.stairs);
    expect(voxelMovementFloor(world, { x: 2.8, y: 3.5, z: 3 })).toBe(4);
    world.setCell(3, 3, 4, M.stairs);
    expect(voxelMovementFloor(world, { x: 2.8, y: 3.5, z: 3 })).toBeNull();
  });
  it("blocks foliage, trunks and roofs at any attempted feet height", () => {
    const world = new World({ width: 8, depth: 8, height: 12 });
    world.fill(box(0, 0, 0, 8, 8, 3), M.grass);
    world.setCell(3, 3, 3, M.leaves);
    world.fill(box(4, 3, 3, 5, 4, 7), M.log);
    world.fill(box(5, 3, 3, 6, 4, 7), M.roof);
    for (const x of [3.5, 4.5, 5.5]) {
      for (const z of [3, 4, 6, 7]) expect(voxelMovementFloor(world, { x, y: 3.5, z })).toBeNull();
    }
    expect(voxelMovementFloor(world, { x: 2.5, y: 3.5, z: 6 })).toBeNull();
  });

  it("recovers overlapping and out-of-bounds spawns to the nearest clear position", () => {
    const world = new World({ width: 8, depth: 8, height: 12 });
    world.fill(box(0, 0, 0, 8, 8, 3), M.grass);
    world.fill(box(3, 3, 3, 4, 4, 7), M.brickWall);
    for (const position of [{ x: 3.5, y: 3.5, z: 3 }, { x: -5, y: 2.5, z: 3 }, { x: 1.5, y: 2.5, z: 8 }]) {
      const recovered = nearestVoxelPosition(world, position);
      expect(voxelMovementFloor(world, recovered)).toBe(recovered.z);
      expect(recovered.z).toBe(3);
    }
    expect(nearestVoxelPosition(world, { x: 3.5, y: 3.5, z: 3 })).toEqual({ x: 3.5, y: 2.5, z: 3 });
    expect(() => nearestVoxelPosition(new World({ width: 2, depth: 2, height: 4 }), { x: 1, y: 1, z: 1 })).toThrow("no free player position");
  });

  it("keeps 50 seeded random routes clear and moving unless both axes face obstacles", () => {
    const world = createMeadowHouseWorld();
    let seed = 1403;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
    for (let route = 0; route < 50; route++) {
      const start = nearestVoxelPosition(world, { x: random() * world.width, y: random() * world.depth, z: 3 });
      const state = createMovement(start);
      const input = { x: Math.round(random() * 2) - 1, y: Math.round(random() * 2) - 1 };
      if (input.x === 0 && input.y === 0) input.x = 1;
      let stalled = 0;
      for (let frame = 0; frame < 180; frame++) {
        const before = { x: state.x, y: state.y, z: state.z };
        stepMovement(state, input, DEFAULT_MOVEMENT, (position) => voxelMovementFloor(world, position));
        expect(voxelMovementFloor(world, state)).toBe(state.z);
        expect(Math.abs(state.z - before.z)).toBeLessThanOrEqual(1);
        stalled = state.moving ? 0 : stalled + 1;
        if (stalled > 60) {
          for (const axis of ["x", "y"] as const) {
            if (input[axis] !== 0) expect(voxelMovementFloor(world, { ...state, [axis]: state[axis] + input[axis] * 0.05 })).toBeNull();
          }
        }
      }
    }
  });
  it("checks the full AABB against walls, water and world boundaries", () => {
    const world = new World({ width: 8, depth: 8, height: 10 });
    world.fill(box(0, 0, 0, 8, 8, 3), M.grass);
    world.fill(box(3, 0, 3, 4, 8, 6), M.brickWall);
    world.fill(box(5, 0, 2, 6, 8, 3), M.water);
    expect(voxelMovementFloor(world, { x: 2.8, y: 2.5, z: 3 })).toBeNull();
    expect(voxelMovementFloor(world, { x: 4.8, y: 2.5, z: 3 })).toBeNull();
    expect(voxelMovementFloor(world, { x: 0.1, y: 2.5, z: 3 })).toBeNull();
    expect(voxelMovementFloor(world, { x: 2.5, y: 2.5, z: 3 })).toBe(3);
    const state = createMovement({ x: 2.5, y: 2.5, z: 3 });
    walk(world, state, 1, 1, 60);
    expect(state.x).toBeLessThan(2.8);
    expect(state.y).toBeGreaterThan(4);
  });

  it("walks through the house door and both floors without climbing the roof", () => {
    const world = createMeadowHouseWorld();
    const state = createMovement({ x: 12.5, y: 45.5, z: 3 });
    walk(world, state, 0, -1, 122);
    expect(state.y).toBeLessThan(38);
    expect(state.z).toBe(3);
    // Pass through the inner doorway, then approach the stairs from the west.
    walk(world, state, 1, 0, 98);
    expect(state.x).toBeGreaterThan(18.7);
    walk(world, state, 0, -1, 88);
    expect(state.y).toBeLessThan(32);
    walk(world, state, 1, 0, 72);
    expect(state.x).toBeGreaterThan(23);
    expect(state.z).toBe(6);
    walk(world, state, -1, 0, 72);
    expect(state.z).toBe(3);
  });

  it("uses the bridge and hill stairs, but rejects the two-cell cliffs", () => {
    const world = createMeadowHouseWorld();
    const bridge = createMovement({ x: 37.5, y: 48, z: 3 });
    walk(world, bridge, 1, 0, 220);
    expect(bridge.x).toBeGreaterThan(50);
    expect(bridge.z).toBe(3);
    const hill = createMovement({ x: 53.5, y: 29, z: 3 });
    walk(world, hill, 1, 0, 210);
    expect(hill.x).toBeGreaterThan(66);
    expect(hill.z).toBe(7);
    walk(world, hill, -1, 0, 210);
    expect(hill.z).toBe(3);
    expect(voxelMovementFloor(world, { x: 56.1, y: 35, z: 3 })).toBeNull();
    expect(voxelMovementFloor(world, { x: 44, y: 60, z: 3 })).toBeNull();
  });

  it("rejects stairs without shared two-cell headroom", () => {
    const world = new World({ width: 8, depth: 8, height: 10 });
    world.fill(box(0, 0, 0, 8, 8, 3), M.grass);
    world.fill(box(3, 0, 3, 4, 8, 4), M.stairs);
    world.fill(box(2, 0, 5, 3, 8, 6), M.planks);
    expect(voxelMovementFloor(world, { x: 2.8, y: 2.5, z: 3 })).toBeNull();
  });
});

it("rotates controls with the camera and follows independently of frame rate", () => {
  expect(cameraMovement({ x: 1, y: 0 }, 90).y).toBeCloseTo(1);
  expect(cameraMovement({ x: 0, y: 1 }, 90).x).toBeCloseTo(-1);
  expect(1 - (1 - followBlend(10, 1 / 60)) ** 60).toBeCloseTo(followBlend(10, 1));
  expect(followBlend(0, 1)).toBe(0);
});
