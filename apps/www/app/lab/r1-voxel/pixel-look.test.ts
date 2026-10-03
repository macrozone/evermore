import { describe, expect, it } from "vitest";
import { DEFAULT_LOOK, renderDimensions } from "./pixel-look";

describe("pixel render dimensions", () => {
  it("caps wide screens while preserving a consistent pixel scale", () => {
    expect(renderDimensions(1920, 1080, DEFAULT_LOOK)).toEqual({ width: 960, height: 540 });
  });
  it("lets the pixel-size control coarsen the target", () => {
    expect(renderDimensions(1200, 600, { ...DEFAULT_LOOK, pixelSize: 4 })).toEqual({ width: 300, height: 150 });
  });
  it("keeps tiny targets valid", () => {
    expect(renderDimensions(1, 1, DEFAULT_LOOK)).toEqual({ width: 1, height: 1 });
  });
});
