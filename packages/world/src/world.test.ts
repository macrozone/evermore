import { describe, expect, it } from "vitest";

import { box } from "./geometry";
import { AIR, M } from "./materials";
import { CHUNK_SIZE_X, CHUNK_SIZE_Z, World } from "./world";

function flatWorld(): World {
  const world = new World({ width: 40, depth: 40, height: 20 });
  world.fill(box(0, 0, 0, 40, 40, 1), M.stone);
  world.fill(box(0, 0, 1, 40, 40, 2), M.grass);
  return world;
}

describe("World cells", () => {
  it("reads air for unset cells and outside the world", () => {
    const world = new World({ width: 10, depth: 10, height: 10 });
    expect(world.getCell(3, 3, 3)).toBe(AIR);
    expect(world.getCell(-1, 0, 0)).toBe(AIR);
    expect(world.getCell(10, 0, 0)).toBe(AIR);
    expect([...world.chunks()]).toHaveLength(0);
  });

  it("stores cells across chunk borders", () => {
    const world = new World({ width: 70, depth: 40, height: 20 });
    const x = CHUNK_SIZE_X;
    const z = CHUNK_SIZE_Z;
    world.setCell(x - 1, 5, z - 1, M.dirt);
    world.setCell(x, 5, z, M.water);
    expect(world.getCell(x - 1, 5, z - 1)).toBe(M.dirt);
    expect(world.getCell(x, 5, z)).toBe(M.water);
    expect(world.getChunk(0, 0, 0)).toBeDefined();
    expect(world.getChunk(1, 0, 1)).toBeDefined();
    expect(world.getChunk(1, 0, 0)).toBeUndefined();
  });

  it("does not allocate chunks for air", () => {
    const world = new World({ width: 10, depth: 10, height: 10 });
    world.setCell(1, 1, 1, AIR);
    expect([...world.chunks()]).toHaveLength(0);
  });

  it("rejects writes outside the world and unknown materials", () => {
    const world = new World({ width: 10, depth: 10, height: 10 });
    expect(() => world.setCell(10, 0, 0, M.stone)).toThrow(RangeError);
    expect(() => world.setCell(0.5, 0, 0, M.stone)).toThrow(RangeError);
    expect(() => world.setCell(0, 0, 0, 9999)).toThrow(RangeError);
  });

  it("validates its size", () => {
    expect(() => new World({ width: 0, depth: 1, height: 1 })).toThrow(RangeError);
  });

  it("clips fills to the world", () => {
    const world = new World({ width: 4, depth: 4, height: 4 });
    world.fill(box(-5, -5, 0, 50, 50, 1), M.sand);
    expect(world.getCell(0, 0, 0)).toBe(M.sand);
    expect(world.getCell(3, 3, 0)).toBe(M.sand);
    expect(world.getCell(3, 3, 1)).toBe(AIR);
  });
});

describe("heightAt", () => {
  it("returns the surface above the highest solid cell", () => {
    const world = flatWorld();
    expect(world.heightAt(5, 5)).toBe(2);
    world.setCell(5, 5, 6, M.roof);
    expect(world.heightAt(5, 5)).toBe(7);
  });

  it("limits the search to maxZ to find floors under a roof", () => {
    const world = flatWorld();
    world.setCell(5, 5, 6, M.roof);
    expect(world.heightAt(5, 5, 3)).toBe(2);
    expect(world.heightAt(5, 5, 7)).toBe(7);
  });

  it("ignores non-solid materials and returns 0 for empty columns", () => {
    const world = flatWorld();
    world.setCell(5, 5, 2, M.leaves);
    expect(world.heightAt(5, 5)).toBe(2);
    expect(new World({ width: 2, depth: 2, height: 2 }).heightAt(0, 0)).toBe(0);
    expect(world.heightAt(-1, 0)).toBe(0);
  });
});

describe("isWalkable", () => {
  it("allows standing on walkable ground with headroom", () => {
    const world = flatWorld();
    expect(world.isWalkable(5, 5, 2)).toBe(true);
    expect(world.isWalkable(5, 5, 3)).toBe(false); // floating
    expect(world.isWalkable(5, 5, 1)).toBe(false); // inside the ground
  });

  it("does not allow standing on water or walls", () => {
    const world = flatWorld();
    world.setCell(5, 5, 1, M.water);
    expect(world.isWalkable(5, 5, 2)).toBe(false);
    world.setCell(6, 6, 2, M.stoneWall);
    expect(world.isWalkable(6, 6, 3)).toBe(false);
  });

  it("needs two free cells of headroom", () => {
    const world = flatWorld();
    world.setCell(5, 5, 3, M.planks);
    expect(world.isWalkable(5, 5, 2)).toBe(false);
    world.setCell(5, 5, 3, M.leaves);
    expect(world.isWalkable(5, 5, 2)).toBe(true);
  });

  it("is false at the top of the world and outside", () => {
    const world = new World({ width: 2, depth: 2, height: 3 });
    world.fill(box(0, 0, 0, 2, 2, 2), M.grass);
    expect(world.isWalkable(0, 0, 2)).toBe(false);
    expect(world.isWalkable(-1, 0, 1)).toBe(false);
  });
});

describe("structures", () => {
  it("finds structures at a cell, innermost first", () => {
    const world = flatWorld();
    world.addStructure({ id: "house", kind: "building", name: "House", bounds: box(0, 0, 0, 10, 10, 10) });
    world.addStructure({
      id: "house.room",
      kind: "room",
      name: "Room",
      parentId: "house",
      bounds: box(1, 1, 2, 5, 5, 4),
    });
    expect(world.structuresAt(2, 2, 2).map((s) => s.id)).toEqual(["house.room", "house"]);
    expect(world.structuresAt(8, 8, 2).map((s) => s.id)).toEqual(["house"]);
    expect(world.structuresAt(20, 20, 2)).toEqual([]);
    expect(world.getStructure("house")?.name).toBe("House");
  });

  it("rejects duplicate ids and unknown parents", () => {
    const world = flatWorld();
    const bounds = box(0, 0, 0, 1, 1, 1);
    world.addStructure({ id: "a", kind: "building", name: "A", bounds });
    expect(() => world.addStructure({ id: "a", kind: "building", name: "A", bounds })).toThrow();
    expect(() =>
      world.addStructure({ id: "b", kind: "room", name: "B", bounds, parentId: "missing" }),
    ).toThrow();
  });
});
