import { createMeadowHouseWorld, M, World } from "@evermore/world";
import { describe, expect, it } from "vitest";
import { columnTiles, overlapsPlayer, project, stepPlayer } from "./tilemap-model";

describe("R2 tilemap adapter", () => {
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
