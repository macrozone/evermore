import { M } from "@evermore/world";
import { NearestFilter } from "three";
import { describe, expect, it } from "vitest";
import { createSurfaceAtlas, surfaceTone } from "./voxel-textures";

describe("voxel surface atlas", () => {
  it("provides bounded, distinct grass, wood, water and masonry patterns", () => {
    const patterns = [M.grass, M.planks, M.water, M.roof].map((id) => {
      const samples = Array.from({ length: 256 }, (_, i) => surfaceTone(id, i % 16, Math.floor(i / 16)));
      expect(Math.min(...samples)).toBeGreaterThan(0);
      expect(Math.max(...samples)).toBeLessThanOrEqual(1.4);
      expect(new Set(samples).size).toBeGreaterThan(1);
      return JSON.stringify(samples);
    });
    expect(new Set(patterns).size).toBe(4);
  });
  it("uploads complete nearest-filtered tiles without mipmap blur", () => {
    const atlas = createSurfaceAtlas();
    expect(atlas.magFilter).toBe(NearestFilter);
    expect(atlas.minFilter).toBe(NearestFilter);
    expect(atlas.generateMipmaps).toBe(false);
    const { data, width, height } = atlas.image;
    expect(data?.length).toBe(width * height * 4);
    for (let i = 3; i < data!.length; i += 4) expect(data![i]).toBe(255);
    atlas.dispose();
  });
});
