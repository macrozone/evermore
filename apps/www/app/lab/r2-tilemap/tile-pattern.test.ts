import { MATERIALS, M } from "@evermore/world";
import { describe, expect, it } from "vitest";
import { tilePattern } from "./tile-pattern";

describe("procedural pixel tiles", () => {
  it("keeps every mark on the shared integer pixel grid and inside its tile", () => {
    for (const material of MATERIALS) for (const [x, y] of [[0, 0], [12, 45], [95, 95]] as const) {
      for (const mark of tilePattern(material.id, x, y)) {
        expect([mark.x, mark.y, mark.width, mark.height].every(Number.isInteger)).toBe(true);
        expect(mark.x).toBeGreaterThanOrEqual(0);
        expect(mark.y).toBeGreaterThanOrEqual(0);
        expect(mark.x + mark.width).toBeLessThanOrEqual(20);
        expect(mark.y + mark.height).toBeLessThanOrEqual(20);
      }
    }
  });
  it("varies terrain by location without changing on redraw", () => {
    expect(tilePattern(M.grass, 12, 45)).toEqual(tilePattern(M.grass, 12, 45));
    expect(tilePattern(M.grass, 12, 45)).not.toEqual(tilePattern(M.grass, 13, 45));
    expect(tilePattern(M.grass, 12, 45)).not.toEqual(tilePattern(M.water, 12, 45));
  });
});
