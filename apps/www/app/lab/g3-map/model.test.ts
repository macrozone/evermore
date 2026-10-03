import { describe, expect, it } from "vitest";
import { AIR, deserializeWorld, serializeWorld } from "@evermore/world";
import { analyse, exportAnalysis, PALETTE, type Raster } from "./model";

function raster(width: number, height: number, pixel: (x: number, y: number) => number[]): Raster {
  return { width, height, data: Uint8ClampedArray.from(Array.from({ length: width * height }, (_, i) => pixel(i % width, Math.floor(i / width))).flat()) };
}
const rgba = (color: number) => [color >> 16, color >> 8 & 255, color & 255, 255];
const settings = { tileSize: 8, maxDistance: .22, heightScale: 12 };

describe("observed image surfaces", () => {
  it("classifies exact palette colours, leaving covered layers unknown", () => {
    const source = raster(80, 8, x => rgba(PALETTE[Math.floor(x / 8)]!.color));
    const result = analyse(source, settings);
    expect(result.unknown).toBe(0);
    expect(result.tiles.map(tile => tile.material)).toEqual(PALETTE.map(entry => entry.material));
    const restored = deserializeWorld(serializeWorld(result.world));
    PALETTE.forEach((entry, x) => {
      const height = entry.level * 3;
      expect(restored.getCell(x, 0, height)).toBe(entry.material);
      for (const layer of ["ground", "object", "overhead"] as const) {
        expect(result.layers[layer][x]).toBe(layer === entry.layer ? entry.material : null);
      }
      if (height > 0) expect(restored.getCell(x, 0, height - 1)).toBe(AIR);
    });
    const exported = exportAnalysis(result, settings, { source: "fixture" });
    expect(exported.provenance).toEqual({ source: "fixture" });
    expect(exported.unknown).toContain("not navigable");
    expect(exported.heightsRaster).toEqual(result.tiles.map(tile => tile.height));
  });
  it("uses the median rather than highlights and includes partial edge tiles", () => {
    const source = raster(17, 9, (x, y) => rgba(x === 0 && y === 0 ? 0xffffff : PALETTE[0].color));
    const result = analyse(source, settings);
    expect([result.columns, result.rows]).toEqual([3, 2]);
    expect(result.tiles.every(tile => tile.material === PALETTE[0].material)).toBe(true);
  });
  it("rejects distant, ambiguous and predominantly transparent tiles", () => {
    const source = raster(24, 8, x => x < 8 ? rgba(0xff00ff) : x < 16 ? rgba(0x55647d) : [0x70, 0x94, 0x52, 0]);
    const result = analyse(source, { ...settings, maxDistance: .1 });
    expect(result.unknown).toBe(3);
    expect(result.layers.ground).toEqual([null, null, null]);
  });
  it("applies strict and permissive distance extremes, and zero and maximum heights", () => {
    const source = raster(8, 8, () => rgba(PALETTE[8].color + 1));
    expect(analyse(source, { ...settings, maxDistance: 0 }).unknown).toBe(1);
    expect(analyse(source, { ...settings, maxDistance: .6, heightScale: 0 }).tiles[0]!.height).toBe(0);
    expect(analyse(source, { ...settings, maxDistance: .6 }).tiles[0]!.height).toBe(12);
    expect(analyse(raster(129, 8, () => rgba(PALETTE[0].color)), { ...settings, tileSize: 128 }).columns).toBe(2);
  });
  it("bounds raster memory and invalid settings", () => {
    const source = raster(8, 8, () => rgba(0));
    for (const invalid of [{ tileSize: 0 }, { tileSize: 129 }, { maxDistance: NaN }, { maxDistance: .61 }, { heightScale: -1 }, { heightScale: 13 }]) {
      expect(() => analyse(source, { ...settings, ...invalid })).toThrow(RangeError);
    }
    expect(() => analyse({ ...source, width: 2049 }, settings)).toThrow(RangeError);
    expect(() => analyse({ ...source, data: new Uint8ClampedArray(1) }, settings)).toThrow(RangeError);
  });
});
