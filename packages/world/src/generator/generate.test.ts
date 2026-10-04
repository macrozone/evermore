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
  it.each([0, 1, 2, 3])("wakes beside the bed on floor %i with an exit to the ground", floor => {
    const spec = structuredClone(WORLD_EXAMPLES[0]!);
    spec.settlement.buildings = [{ name: "Small home", x: 24, y: 18, width: 8, depth: 8, floors: 4 }];
    spec.sleepingPlace = { name: "My room above the kitchen", buildingIndex: 0, floor };
    const before = JSON.stringify(spec);
    const world = generateWorld(spec, 42);
    expect(JSON.stringify(spec)).toBe(before);
    expect(world.spawn).toEqual({ x: 28, y: 21, z: 3 + floor * 4 });
    expect(world.getCell(29, 21, world.spawn.z)).toBe(M.bed);
    expect(world.getCell(29, 22, world.spawn.z)).toBe(M.bed);
    expect(world.isWalkable(world.spawn.x, world.spawn.y, world.spawn.z)).toBe(true);
    const queue = [world.spawn], seen = new Set<string>();
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i]!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let dz = -1; dz <= 1; dz++) {
        const next = { x: p.x + dx!, y: p.y + dy!, z: p.z + dz };
        const key = JSON.stringify(next);
        if (!seen.has(key) && world.isWalkable(next.x, next.y, next.z)) { seen.add(key); queue.push(next); }
      }
    }
    expect(queue.some(p => p.x === spec.spawn.x && p.y === spec.spawn.y && p.z === 3)).toBe(true);
    expect(encodeWorld(world)).toEqual(encodeWorld(generateWorld(spec, 42)));
  });
  it("reserves a dry outdoor sleeping place even by water and dense trees", () => {
    const spec = structuredClone(WORLD_EXAMPLES[1]!);
    spec.spawn = { x: 1, y: 1 };
    spec.vegetation.density = 0.3;
    spec.paths = false;
    spec.sleepingPlace = { name: "Under the stars", buildingIndex: null, floor: 0 };
    const world = generateWorld(spec, 11);
    expect(world.isWalkable(world.spawn.x, world.spawn.y, world.spawn.z)).toBe(true);
    expect(world.getCell(world.spawn.x + 1, world.spawn.y, world.spawn.z)).toBe(M.bed);
    expect(world.getCell(world.spawn.x, world.spawn.y, world.spawn.z)).toBe(M.air);
    expect(world.isWalkable(world.spawn.x, world.spawn.y + 1, world.spawn.z)).toBe(true);
  });
  it.each([
    { name: "Missing", buildingIndex: 23, floor: 0 },
    { name: "Above roof", buildingIndex: 0, floor: 3 },
    { name: "Floating outside", buildingIndex: null, floor: 1 },
  ])("rejects invalid sleeping-place references: $name", sleepingPlace => {
    expect(() => parseWorldSpecification({ ...WORLD_EXAMPLES[0], sleepingPlace })).toThrow("sleepingPlace");
  });
  it("rejects malformed and out-of-bounds inputs before generation", () => {
    const valid = WORLD_EXAMPLES[0]!;
    for (const bad of [null, {}, { ...valid, version: 2 }, { ...valid, extra: 1 }, { ...valid, vegetation: { density: NaN } }, { ...valid, spawn: { x: 100, y: 1 } }, { ...valid, size: { ...valid.size, height: 15 } }, { ...valid, settlement: { buildings: [valid.settlement.buildings[0], valid.settlement.buildings[0]] } }]) {
      expect(() => parseWorldSpecification(bad)).toThrow();
    }
  });
  it("rejects inherited-name extras, sparse arrays and landmarks at spawn", () => {
    const spec = structuredClone(WORLD_EXAMPLES[0]!);
    expect(() => parseWorldSpecification({ ...spec, constructor: "unexpected" })).toThrow();
    expect(() => parseWorldSpecification({ ...spec, palette: new Array(1) })).toThrow();
    expect(() => parseWorldSpecification({ ...spec, landmarks: [{ name: "Blocked start", ...spec.spawn }] })).toThrow("Landmark overlaps spawn");
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
