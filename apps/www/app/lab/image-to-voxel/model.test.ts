import { describe, expect, it } from "vitest";
import { deserializeWorld, serializeWorld, AIR } from "@evermore/world";
import { reconstruct, type Raster } from "./model";

function raster(width: number, height: number, value: (x: number, y: number) => number[]): Raster {
  return { width, height, data: Uint8ClampedArray.from(Array.from({ length: width * height }, (_, i) => [...value(i % width, Math.floor(i / width)), 255]).flat()) };
}
const settings = { tileSize: 8, heightScale: 10, method: "heightmap" as const };
describe("image-space shell", () => {
  it("quantizes six levels and emits only exposed south facades and top cells", () => {
    const source = raster(16, 24, () => [40, 90, 30]);
    const map = raster(16, 24, (_, y) => y < 16 ? [255, 255, 255] : [0, 0, 0]);
    const { world, tiles, cells } = reconstruct(source, settings, map);
    expect(tiles.map((t) => t.height)).toEqual([11, 11, 11, 11, 1, 1]);
    expect(world.getCell(0, 0, 9)).toBe(AIR); // hidden interior remains empty
    expect(world.getCell(0, 1, 1)).not.toBe(AIR); // visible tall facade
    expect(world.getCell(0, 1, 0)).toBe(AIR); // occluded by foreground ground
    expect(cells).toBe(24);
    const restored = deserializeWorld(serializeWorld(world));
    expect(restored.getCell(0, 0, 9)).toBe(AIR);
    expect(restored.getCell(0, 1, 1)).toBe(world.getCell(0, 1, 1));
    expect(restored.width).toBe(2);
  });
  it("includes partial edge tiles and flattens at zero scale", () => {
    const result = reconstruct(raster(17, 9, () => [20, 50, 90]), { tileSize: 8, heightScale: 0, method: "heuristic" });
    expect([result.columns, result.rows, result.cells]).toEqual([3, 2, 6]);
    expect(result.tiles.every((t) => t.height === 1)).toBe(true);
  });
  it("rejects missing, mismatched and unbounded inputs", () => {
    const source = raster(8, 8, () => [0, 0, 0]);
    expect(() => reconstruct(source, settings)).toThrow("heightmap");
    expect(() => reconstruct(source, settings, raster(16, 8, () => [0, 0, 0]))).toThrow("dimensions");
    expect(() => reconstruct(source, { ...settings, tileSize: 0 })).toThrow();
    expect(() => reconstruct(source, { ...settings, heightScale: 13 })).toThrow();
  });
});

describe("top surfaces and anchored facade geometry", () => {
  const topMap = raster(8, 40, (_, y) => y < 8 ? [204, 204, 204] : [51, 51, 51]);
  const mask = raster(8, 40, (_, y) => y >= 8 && y < 32 ? [255, 255, 255] : [0, 0, 0]);
  const options = { ...settings, method: "facade" as const };
  it("puts the wall from ground to eave on one ground column and interpolates heights", () => {
    const result = reconstruct(raster(8, 40, () => [150, 80, 40]), options, topMap, mask);
    // Ground is z=2; eave is z=8; bottom anchor screen row 4 + z=2.
    for (let z = 2; z <= 8; z++) expect(result.world.getCell(0, 6, z)).not.toBe(AIR);
    expect(result.world.getCell(0, 6, 1)).toBe(AIR);
    expect(result.world.getCell(0, 6, 9)).toBe(AIR);
    expect(result.world.getCell(0, 1, 2)).toBe(AIR); // no separate extrusion of facade image rows
    expect(result.tiles.slice(1, 4).map(tile => tile.height)).toEqual([9, 6, 3]);
    expect(result.unresolvedFacades).toBe(0);
    expect(deserializeWorld(serializeWorld(result.world)).getCell(0, 6, 8)).not.toBe(AIR);
  });
  it("keeps geometry independent of dark timber, bright windows and bogus facade map values", () => {
    const dark = reconstruct(raster(8, 40, () => [10, 10, 10]), options, topMap, mask);
    const brightMap = raster(8, 40, (_, y) => y >= 8 && y < 32 ? [255, 255, 255] : y < 8 ? [204, 204, 204] : [51, 51, 51]);
    const bright = reconstruct(raster(8, 40, () => [240, 200, 180]), options, brightMap, mask);
    expect(bright.tiles.map(tile => tile.height)).toEqual(dark.tiles.map(tile => tile.height));
    expect([...bright.cellColors!.keys()]).toEqual([...dark.cellColors!.keys()]);
  });
  it("omits unanchored and inverted walls rather than guessing heights", () => {
    const source = raster(8, 40, () => [80, 80, 80]);
    const inverted = raster(8, 40, (_, y) => y < 8 ? [51, 51, 51] : [204, 204, 204]);
    expect(reconstruct(source, options, inverted, mask).unresolvedFacades).toBe(1);
    const edge = raster(8, 40, (_, y) => y < 16 ? [255, 255, 255] : [0, 0, 0]);
    expect(reconstruct(source, options, topMap, edge).unresolvedFacades).toBe(1);
    expect(reconstruct(source, { ...options, heightScale: 0 }, topMap, mask).world.height).toBe(4);
  });
  it("rejects a missing or mismatched mask", () => {
    const source = raster(8, 40, () => [80, 80, 80]);
    expect(() => reconstruct(source, options, topMap)).toThrow("facade mask");
    expect(() => reconstruct(source, options, topMap, raster(8, 8, () => [0, 0, 0]))).toThrow("dimensions");
  });
});
