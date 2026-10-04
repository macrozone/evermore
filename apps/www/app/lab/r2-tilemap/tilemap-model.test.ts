import { generateWorld, WORLD_EXAMPLES, createMeadowHouseWorld, M, World } from "@evermore/world";
import { createMovement, DEFAULT_MOVEMENT, stepMovement } from "@evermore/core";
import { describe, expect, it } from "vitest";
import { columnTiles, movementFloor, overlapsPlayer, project, stepPlayer } from "./tilemap-model";

describe("R2 tilemap adapter", () => {
  it.each(WORLD_EXAMPLES)("renders and permits movement from the generated spawn: $name", (specification) => {
    const world = generateWorld(specification, "r2-playable");
    const start = { x: world.spawn.x + 0.5, y: world.spawn.y + 0.5, z: world.spawn.z };
    expect(movementFloor(world, start)).toBe(start.z);
    expect(columnTiles(world, world.spawn.x, world.spawn.y, world.spawn, true)
      .some(tile => tile.layer === "ground" && tile.z === start.z)).toBe(true);
    const distances = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, y]) => {
      const motion = createMovement(start);
      for (let tick = 0; tick < 60; tick++) stepMovement(motion, { x: x!, y: y! }, DEFAULT_MOVEMENT, position => movementFloor(world, position));
      expect(movementFloor(world, motion)).toBe(motion.z);
      return Math.hypot(motion.x - start.x, motion.y - start.y);
    });
    expect(Math.max(...distances)).toBeGreaterThan(1);
  });
  it("offsets height without rotating the map grid", () => {
    expect(project({ x: 2, y: 4, z: 3 })).toEqual({ x: 40, y: 62 });
  });
  it("enters the actual house door without climbing onto the ceiling", () => {
    const world = createMeadowHouseWorld();
    const door = stepPlayer(world, world.spawn, 0, -1);
    const inside = stepPlayer(world, door, 0, -1);
    expect(inside).toEqual({ x: 12, y: 43, z: 3 });
    expect(world.structuresAt(inside.x, inside.y, inside.z).some((s) => s.id === "house")).toBe(true);
    expect(stepPlayer(world, { x: 11, y: 44, z: 3 }, 0, -1)).toEqual({ x: 11, y: 44, z: 3 });
  });
  it("blocks water, cliffs, world edges and diagonal shortcuts but climbs hill stairs", () => {
    const world = createMeadowHouseWorld();
    const bank = { x: 38, y: 47, z: 3 };
    expect(stepPlayer(world, bank, 1, 0).z).toBe(4);
    const cliff = { x: 55, y: 26, z: 3 };
    expect(stepPlayer(world, cliff, 1, 0)).toBe(cliff);
    expect(stepPlayer(world, { x: 55, y: 28, z: 4 }, 1, 0)).toEqual({ x: 56, y: 28, z: 5 });
    const edge = { x: 0, y: 0, z: 3 };
    expect(stepPlayer(world, edge, -1, 0)).toBe(edge);
    expect(stepPlayer(world, edge, 1, 1)).toBe(edge);
    const river = { x: 41, y: 60, z: 3 };
    expect(stepPlayer(world, river, 1, 0)).toBe(river);
  });
  it("reaches both house storeys, the far bank and tower platform with renderer movement", () => {
    const world = createMeadowHouseWorld();
    const key = (p: { x: number; y: number; z: number }) => `${p.x},${p.y},${p.z}`;
    const queue = [world.spawn];
    const seen = new Set([key(world.spawn)]);
    for (let current = queue.pop(); current != null; current = queue.pop()) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const next = stepPlayer(world, current, dx, dy);
        if (!seen.has(key(next))) { seen.add(key(next)); queue.push(next); }
      }
    }
    for (const target of ["12,36,3", "22,40,3", "12,36,6", "22,40,6", "50,47,3", "70,30,7", "74,22,19"]) expect(seen.has(target), target).toBe(true);
  });
  it("cuts the roof and upper floor only inside the active building", () => {
    const world = createMeadowHouseWorld();
    const player = { x: 12, y: 40, z: 3 };
    const outside = columnTiles(world, 12, 40, player, false);
    expect(outside.some((tile) => tile.material === M.roof)).toBe(true);
    const inside = columnTiles(world, 12, 40, player, true);
    expect(inside.some((tile) => tile.material === M.planks && tile.z === 3)).toBe(true);
    expect(inside.every((tile) => tile.z <= 5)).toBe(true);
    expect(columnTiles(world, 75, 22, player, true)).toEqual(columnTiles(world, 75, 22, player, false));
  });
  it("preserves non-solid canopy tiles above the walkable ground", () => {
    const world = new World({ width: 4, depth: 4, height: 16 });
    world.setCell(1, 1, 2, M.grass);
    world.setCell(1, 1, 5, M.leaves);
    const tiles = columnTiles(world, 1, 1, { x: 1, y: 1, z: 3 }, true);
    expect(tiles.map((tile) => tile.layer)).toEqual(["ground", "overhead"]);
    expect(world.isWalkable(1, 1, 3)).toBe(true);
    expect(overlapsPlayer(tiles[1]!, { x: 1, y: 1, z: 3 })).toBe(true);
    expect(overlapsPlayer(tiles[1]!, { x: 2, y: 1, z: 3 })).toBe(false);
  });
});

describe("continuous movement floor", () => {
  it("traverses the actual doorway, house stairs and hill stairs continuously", () => {
    const world = createMeadowHouseWorld();
    function traverse(from: { x: number; y: number; z: number }, to: { x: number; y: number }, targetZ: number) {
      let z = from.z;
      const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 0.04);
      for (let i = 0; i <= steps; i++) {
        const p = { x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps, z };
        const floor = movementFloor(world, p);
        expect(floor, JSON.stringify(p)).not.toBeNull();
        z = floor!;
      }
      expect(z).toBe(targetZ);
    }
    traverse({ x: 12.5, y: 45.5, z: 3 }, { x: 12.5, y: 42.5 }, 3);
    traverse({ x: 19.5, y: 32, z: 3 }, { x: 23.5, y: 32 }, 6);
    traverse({ x: 23.5, y: 32, z: 6 }, { x: 19.5, y: 32 }, 3);
    traverse({ x: 54.5, y: 29, z: 3 }, { x: 57.5, y: 29 }, 5);
    traverse({ x: 57.5, y: 29, z: 5 }, { x: 54.5, y: 29 }, 3);
  });

  it("checks the whole footprint at walls, water and world edges", () => {
    const world = createMeadowHouseWorld();
    expect(movementFloor(world, { x: 12.5, y: 43.5, z: 3 })).toBe(3);
    expect(movementFloor(world, { x: 12.1, y: 43.5, z: 3 })).toBeNull();
    expect(movementFloor(world, { x: 0.1, y: 0.5, z: 3 })).toBeNull();
    expect(movementFloor(world, { x: 42.5, y: 60.5, z: 3 })).toBeNull();
  });
  it("crosses ascending and descending steps without catching the footprint", () => {
    const world = new World({ width: 6, depth: 3, height: 12 });
    for (let x = 0; x < 6; x++) for (let y = 0; y < 3; y++) {
      for (let z = 0; z < 3 + Math.min(x, 3); z++) world.setCell(x, y, z, M.stairs);
    }
    let z = 3;
    for (let x = 0.5; x <= 5.5; x += 0.05) {
      const floor = movementFloor(world, { x, y: 1.5, z });
      expect(floor, `ascending at ${x}`).not.toBeNull();
      z = floor!;
    }
    expect(z).toBe(6);
    for (let x = 5.5; x >= 0.5; x -= 0.05) {
      const floor = movementFloor(world, { x, y: 1.5, z });
      expect(floor, `descending at ${x}`).not.toBeNull();
      z = floor!;
    }
    expect(z).toBe(3);
  });
});
