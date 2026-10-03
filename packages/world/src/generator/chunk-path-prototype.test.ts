import { describe, expect, it } from "vitest";
import { box } from "../geometry";
import { M } from "../materials";
import { encodeWorld } from "../serialization";
import { World } from "../world";
import { connectPrototypePath, generatePrototypeChunk, prototypeSurface } from "./chunk-path-prototype";

function terrain(seed = 42) {
  return new World({ width: 70, depth: 40, height: 8, seed });
}
function load(world: World) {
  for (let cy = 0; cy < world.chunksY; cy++) for (let cx = 0; cx < world.chunksX; cx++) generatePrototypeChunk(world, cx, cy);
}

describe("chunk/path research prototype", () => {
  it("generates identical bytes regardless of chunk request order, including partial edge chunks", () => {
    const a = terrain(), b = terrain();
    load(a);
    for (let cy = b.chunksY - 1; cy >= 0; cy--) for (let cx = b.chunksX - 1; cx >= 0; cx--) generatePrototypeChunk(b, cx, cy);
    expect(encodeWorld(a)).toEqual(encodeWorld(b));
    const other = terrain(43);
    load(other);
    expect(encodeWorld(a)).not.toEqual(encodeWorld(other));
    for (let y = 0; y < a.depth; y++) for (let x = 0; x < a.width; x++) {
      expect(a.heightAt(x, y)).toBe(prototypeSurface(a.seed, x, y).top);
      if (x > 0 && (x < 30 || x > 34)) expect(Math.abs(a.heightAt(x, y) - a.heightAt(x - 1, y))).toBeLessThanOrEqual(1);
    }
  });
  it("allocates only requested chunks and never overwrites an edited column", () => {
    const world = terrain();
    expect([...world.chunks()]).toHaveLength(0);
    generatePrototypeChunk(world, 0, 0);
    expect([...world.chunks()]).toHaveLength(1);
    world.setCell(1, 1, 5, M.stoneWall);
    expect(generatePrototypeChunk(world, 0, 0)).toBe(false);
    expect(world.getCell(1, 1, 5)).toBe(M.stoneWall);
    expect(world.getCell(40, 1, 0)).toBe(M.air);
    expect(() => generatePrototypeChunk(world, -1, 0)).toThrow(RangeError);
    expect(() => generatePrototypeChunk(world, 0.5, 0)).toThrow(RangeError);
  });
  it("connects landmarks across chunks with walkable elevation changes and a bridge above water", () => {
    const world = terrain();
    load(world);
    const start = { x: 4, y: 16, z: world.heightAt(4, 16) };
    const goal = { x: 64, y: 16, z: world.heightAt(64, 16) };
    const path = connectPrototypePath(world, start, goal)!;
    expect(path).not.toBeNull();
    expect(path[0]).toEqual(start);
    expect(path.at(-1)).toEqual(goal);
    expect(path.some(p => world.getCell(p.x, p.y, p.z - 1) === M.planks)).toBe(true);
    for (let i = 0; i < path.length; i++) {
      const p = path[i]!;
      expect(world.isWalkable(p.x, p.y, p.z)).toBe(true);
      if (p.x >= 30 && p.x <= 33) expect(world.getCell(p.x, p.y, 0)).toBe(M.water);
      if (i > 0) {
        const prev = path[i - 1]!;
        expect(Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y)).toBe(1);
        expect(Math.abs(p.z - prev.z)).toBeLessThanOrEqual(1);
      }
    }
    const second = terrain(); load(second);
    expect(connectPrototypePath(second, start, goal)).toEqual(path);
  });
  it("detours around obstacles and does not modify an unreachable world", () => {
    const world = new World({ width: 12, depth: 12, height: 8 });
    world.fill(box(0, 0, 0, 12, 12, 2), M.grass);
    world.fill(box(5, 3, 2, 6, 9, 5), M.stoneWall);
    const start = { x: 2, y: 6, z: 2 }, goal = { x: 10, y: 6, z: 2 };
    const path = connectPrototypePath(world, start, goal)!;
    expect(path.some(p => p.y < 3 || p.y >= 9)).toBe(true);
    world.fill(box(5, 0, 2, 6, 12, 5), M.stoneWall);
    const before = encodeWorld(world);
    expect(connectPrototypePath(world, start, goal)).toBeNull();
    expect(encodeWorld(world)).toEqual(before);
  });
  it("rejects unloaded targets, cliffs, obstructed headroom and invalid endpoints", () => {
    const world = terrain(); generatePrototypeChunk(world, 0, 0);
    expect(connectPrototypePath(world, { x: 1, y: 1, z: world.heightAt(1, 1) }, { x: 40, y: 1, z: 2 })).toBeNull();
    const cliff = new World({ width: 4, depth: 1, height: 8 });
    cliff.fill(box(0, 0, 0, 2, 1, 2), M.grass);
    cliff.fill(box(2, 0, 0, 4, 1, 5), M.grass);
    expect(connectPrototypePath(cliff, { x: 0, y: 0, z: 2 }, { x: 3, y: 0, z: 5 })).toBeNull();
    cliff.setCell(0, 0, 3, M.stoneWall);
    expect(connectPrototypePath(cliff, { x: 0, y: 0, z: 2 }, { x: 1, y: 0, z: 2 })).toBeNull();
  });
});
