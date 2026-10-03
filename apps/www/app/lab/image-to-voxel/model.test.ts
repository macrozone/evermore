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
