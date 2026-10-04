import { createMovement, DEFAULT_MOVEMENT, stepMovement } from "@evermore/core";
import { createMeadowHouseWorld, generateWorld, WORLD_EXAMPLES, M, World, box } from "@evermore/world";
import { describe, expect, it } from "vitest";
import { cameraMovement, followBlend, voxelMovementFloor } from "./player-model";

function walk(world: World, state: ReturnType<typeof createMovement>, x: number, y: number, frames: number) {
  for (let frame = 0; frame < frames; frame++) stepMovement(state, { x, y }, DEFAULT_MOVEMENT, (position) => voxelMovementFloor(world, position));
}

describe("voxel player collision", () => {
  it.each([0, 1, 2, 3])("moves away from a generated bed on floor %i", floor => {
    const spec = structuredClone(WORLD_EXAMPLES[0]!);
    spec.settlement.buildings = [{ name: "Small home", x: 24, y: 18, width: 8, depth: 8, floors: 4 }];
    spec.sleepingPlace = { name: "Bedroom", buildingIndex: 0, floor };
    const world = generateWorld(spec, 42);
    const state = createMovement({ ...world.spawn, x: world.spawn.x + 0.5, y: world.spawn.y + 0.5 });
    expect(voxelMovementFloor(world, state)).toBe(world.spawn.z);
    walk(world, state, 0, 1, 20);
    expect(state.y).toBeGreaterThan(world.spawn.y + 1);
    expect(state.z).toBe(world.spawn.z);
    // Follow every edge with the actual body collision, including stair transitions.
    const queue = [world.spawn], seen = new Set([JSON.stringify(world.spawn)]);
    let outside = false;
    for (let i = 0; i < queue.length && !outside; i++) {
      const p = queue[i]!;
      outside = p.z === 3 && p.y >= 26;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let z = p.z, clear = true;
        for (let t = 1; t <= 10; t++) {
          const floor = voxelMovementFloor(world, { x: p.x + 0.5 + dx! * t / 10, y: p.y + 0.5 + dy! * t / 10, z });
          if (floor === null) { clear = false; break; }
          z = floor;
        }
        const next = { x: p.x + dx!, y: p.y + dy!, z }, key = JSON.stringify(next);
        if (clear && !seen.has(key)) { seen.add(key); queue.push(next); }
      }
    }
    expect(outside, "bedside start must have an exit using full player collision").toBe(true);
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
