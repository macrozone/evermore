import { describe, expect, it } from "vitest";
import { createMeadowHouseWorld, deriveShadowWorld, encodeWorld, decodeWorld, findInfluenceOrigin, generateWorld, getMaterial, influenceAt, M, serializeWorld, World, WORLD_EXAMPLES } from "./index";

describe("derived shadow worlds", () => {
  it("deterministically transforms generated worlds without modifying their data or topology", () => {
    const source = generateWorld(WORLD_EXAMPLES[0]!, 123);
    const before = serializeWorld(source);
    const shadow = deriveShadowWorld(source);
    expect(serializeWorld(shadow)).toEqual(serializeWorld(deriveShadowWorld(source)));
    expect(serializeWorld(source)).toEqual(before);
    expect(shadow.structures).toEqual(source.structures);
    expect(shadow.spawn).toEqual(source.spawn);
    expect(shadow.getStructure(source.structures[0]!.id)).not.toBe(source.structures[0]);
    let changed = 0;
    for (let z = 0; z < source.height; z++) {
      for (let y = 0; y < source.depth; y++) {
        for (let x = 0; x < source.width; x++) {
          const original = source.getCell(x, y, z);
          const derived = shadow.getCell(x, y, z);
          expect(derived === M.air).toBe(original === M.air);
          for (const property of ["solid", "walkable", "opaque", "transparent", "occludesPlayer"] as const) {
            expect(getMaterial(derived)[property]).toBe(getMaterial(original)[property]);
          }
          if (derived !== original) changed++;
        }
      }
    }
    expect(changed).toBeGreaterThan(0);
    const decoded = decodeWorld(encodeWorld(shadow));
    expect(decoded.structures).toEqual(shadow.structures);
    expect(decoded.spawn).toEqual(shadow.spawn);
    expect([...decoded.chunks()].map((chunk) => chunk.cells)).toEqual([...shadow.chunks()].map((chunk) => chunk.cells));
  });

  it("selects the first bed, otherwise a copy of spawn, and peaks at home", () => {
    const world = new World({ width: 4, depth: 4, height: 4, spawn: { x: 3, y: 2, z: 1 } });
    expect(findInfluenceOrigin(world)).toEqual(world.spawn);
    expect(findInfluenceOrigin(world)).not.toBe(world.spawn);
    world.setCell(1, 1, 1, M.bed);
    world.setCell(2, 1, 1, M.bed);
    const home = findInfluenceOrigin(world);
    expect(home).toEqual({ x: 1, y: 1, z: 1 });
    expect(influenceAt(home, home, 10)).toBe(1);
    expect(influenceAt({ x: 6, y: 1, z: 3 }, home, 10)).toBe(0.5);
    expect(influenceAt({ x: 11, y: 1, z: 0 }, home, 10)).toBe(0);
    expect(influenceAt({ x: 21, y: 1, z: 0 }, home, 10)).toBe(0);
    for (const radius of [0, -1, Infinity, NaN]) expect(() => influenceAt(home, home, radius)).toThrow(RangeError);
  });

  it("preserves meadow-house beds and home metadata in the derived layout", () => {
    const source = createMeadowHouseWorld();
    const home = findInfluenceOrigin(source);
    expect(source.getCell(home.x, home.y, home.z)).toBe(M.bed);
    const shadow = deriveShadowWorld(source);
    expect(getMaterial(shadow.getCell(home.x, home.y, home.z)).key).toMatch(/^(shadow|decayed)_bed$/);
    expect(shadow.structures).toEqual(source.structures);
  });
});
