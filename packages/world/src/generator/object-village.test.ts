import { describe, expect, it } from "vitest";
import { M } from "../materials";
import { encodeWorld } from "../serialization";
import { generateObjectVillage, type VillageObject } from "./object-village";
const cells = (columns: number, rows: number) => Array.from({ length: columns * rows }, (_, i) => [i % columns, Math.floor(i / columns)] as const);
const library: VillageObject[] = [
  { id: "house", kind: "building", footprint: { columns: 6, rows: 4, occupied: cells(6, 4), collision: cells(6, 4) }, entrance: { x: 3, y: 4 } },
  { id: "cottage", kind: "building", footprint: { columns: 4, rows: 3, occupied: cells(4, 3), collision: cells(4, 3) }, entrance: { x: 2, y: 3 } },
  { id: "tree", kind: "vegetation", footprint: { columns: 1, rows: 1, occupied: [[0, 0]], collision: [[0, 0]] } },
  { id: "well", kind: "decoration", footprint: { columns: 2, rows: 2, occupied: cells(2, 2), collision: cells(2, 2) } },
];
describe("library village", () => {
  it("reuses a catalog deterministically without mutating it", () => {
    const before = JSON.stringify(library);
    const a = generateObjectVillage(library, "village");
    const b = generateObjectVillage(library, "village");
    expect(a.placements).toEqual(b.placements);
    expect(encodeWorld(a.world)).toEqual(encodeWorld(b.world));
    expect(a.placements).not.toEqual(generateObjectVillage(library, "other").placements);
    expect(a.placedBuildings).toBe(24);
    expect(JSON.stringify(library)).toBe(before);
  });
  for (const size of [48, 64, 96, 128]) for (const seed of [0, 17, "forest"]) {
    it(`has nonoverlapping footprints and reachable doors: ${size}/${seed}`, () => {
      const { world, placements, placedBuildings } = generateObjectVillage(library, seed, { size, buildings: 40, edgeDensity: 0.3 });
      expect(placedBuildings).toBeGreaterThan(0);
      const occupied = new Set<string>();
      for (const p of placements) {
        const object = library.find(o => o.id === p.objectId)!;
        for (const [dx, dy] of object.footprint.occupied) {
          const x = p.position.x + dx, y = p.position.y + dy;
          expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(size);
          expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThan(size);
          expect(occupied.has(`${x},${y}`)).toBe(false);
          occupied.add(`${x},${y}`);
        }
        for (const [dx, dy] of object.footprint.collision) expect(world.isWalkable(p.position.x + dx, p.position.y + dy, 3)).toBe(false);
      }
      const seen = new Set([`${world.spawn.x},${world.spawn.y}`]);
      const queue = [world.spawn];
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i]!;
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
          const x = p.x + dx, y = p.y + dy, key = `${x},${y}`;
          if (!seen.has(key) && world.isWalkable(x, y, 3)) { seen.add(key); queue.push({ x, y, z: 3 }); }
        }
      }
      expect(world.isWalkable(world.spawn.x, world.spawn.y, 3)).toBe(true);
      const paved = new Set([`${world.spawn.x},${world.spawn.y}`]);
      const roads = [world.spawn];
      for (let i = 0; i < roads.length; i++) {
        const p = roads[i]!;
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
          const x = p.x + dx, y = p.y + dy, key = `${x},${y}`;
          if (!paved.has(key) && world.getCell(x, y, 2) === M.stoneFloor) {
            paved.add(key); roads.push({ x, y, z: 3 });
          }
        }
      }
      for (const p of placements) if (p.entrance) {
        expect(paved.has(`${p.entrance.x},${p.entrance.y}`)).toBe(true);
      }
      for (const p of placements) if (p.entrance) expect(seen.has(`${p.entrance.x},${p.entrance.y}`)).toBe(true);
      for (const p of placements.filter(p => p.objectId === "tree")) expect(Math.min(p.position.x, p.position.y, size - p.position.x - 1, size - p.position.y - 1)).toBeLessThan(7);
    });
  }
  it("rejects unsafe metadata and settings and reports capacity", () => {
    expect(() => generateObjectVillage([], 0)).toThrow();
    expect(() => generateObjectVillage([{ ...library[0]!, entrance: { x: 3, y: 0 } }], 0)).toThrow();
    expect(() => generateObjectVillage(library, 0, { size: 1000, buildings: 1, edgeDensity: 0 })).toThrow();
    expect(() => generateObjectVillage(library, 0, { size: 96, buildings: 1, edgeDensity: NaN })).toThrow();
    const small = generateObjectVillage(library, 0, { size: 48, buildings: 100, edgeDensity: 0 });
    expect(small.placedBuildings).toBeLessThan(small.requestedBuildings);
    expect(generateObjectVillage(library, 0, { size: 48, buildings: 0, edgeDensity: 0 }).placedBuildings).toBe(0);
  });
});
