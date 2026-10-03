import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { encodeWorld } from "../serialization";
import { M } from "../materials";
import { WORLD_EXAMPLES } from "./examples";
import { generateWorld } from "./generate";
import { parseWorldSpecification } from "./specification";

describe("G1 generator", () => {
  for (const spec of WORLD_EXAMPLES) {
    it(`generates deterministic, navigable ${spec.name}`, () => {
      const start = performance.now();
      const world = generateWorld(spec, "g1-test");
      console.info(`${spec.name}: ${(performance.now() - start).toFixed(2)} ms`);
      expect(encodeWorld(world)).toEqual(encodeWorld(generateWorld(spec, "g1-test")));
      expect(encodeWorld(world)).not.toEqual(encodeWorld(generateWorld(spec, "different")));
      expect(world.isWalkable(world.spawn.x, world.spawn.y, world.spawn.z)).toBe(true);
      const seen = new Set<string>();
      const queue = [world.spawn];
      const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
      seen.add(key(world.spawn.x, world.spawn.y, world.spawn.z));
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i]!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let dz = -1; dz <= 1; dz++) {
          const x = p.x + dx!, y = p.y + dy!, z = p.z + dz;
          const k = key(x, y, z);
          if (!seen.has(k) && world.isWalkable(x, y, z)) { seen.add(k); queue.push({ x, y, z }); }
        }
      }
      for (const room of world.structures.filter(s => s.kind === "room")) {
        expect(queue.some(p => p.x >= room.bounds.min.x && p.x < room.bounds.max.x && p.y >= room.bounds.min.y && p.y < room.bounds.max.y && p.z === room.bounds.min.z), room.name).toBe(true);
      }
      expect([...world.chunks()].some(c => c.cells.includes(M.roof))).toBe(true);
      if (spec.water.kind !== "none") expect([...world.chunks()].some(c => c.cells.includes(M.water))).toBe(true);
    });
  }
  it("rejects malformed and out-of-bounds inputs before generation", () => {
    const valid = WORLD_EXAMPLES[0]!;
    for (const bad of [null, {}, { ...valid, version: 2 }, { ...valid, extra: 1 }, { ...valid, vegetation: { density: NaN } }, { ...valid, spawn: { x: 100, y: 1 } }, { ...valid, size: { ...valid.size, height: 15 } }, { ...valid, settlement: { buildings: [valid.settlement.buildings[0], valid.settlement.buildings[0]] } }]) {
      expect(() => parseWorldSpecification(bad)).toThrow();
    }
  });
  it("does not mutate input and supports worlds without buildings or paths", () => {
    const spec = structuredClone(WORLD_EXAMPLES[0]!);
    spec.paths = false;
    spec.settlement.buildings = [];
    const before = JSON.stringify(spec);
    const world = generateWorld(spec, 0);
    expect(JSON.stringify(spec)).toBe(before);
    expect(world.structures).toHaveLength(0);
    expect(world.isWalkable(world.spawn.x, world.spawn.y, world.spawn.z)).toBe(true);
  });
});
