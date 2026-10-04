import { describe, expect, it } from "vitest";
import { ACCESSORY_PARTS, BODY_PARTS, CHARACTER_EXAMPLES, HAIR_PARTS, OUTFIT_PARTS } from "./specification";
import { DIRECTIONS } from "./sprite";
import { DEFAULT_VOXEL_SETTINGS, renderVoxelCharacter } from "./voxel";

const spec = CHARACTER_EXAMPLES[0]!.specification;
const render = renderVoxelCharacter;
describe("voxel character sprites", () => {
  it("keeps silhouettes and transparent borders at all preview resolutions, poses and camera extremes", () => {
    for (const example of CHARACTER_EXAMPLES) for (const density of [16, 24, 32] as const) for (const direction of DIRECTIONS) for (let frame = 0; frame < 4; frame++) for (const elevation of [20, 70]) {
      const sprite = render(example.specification, direction, frame, density, { ...DEFAULT_VOXEL_SETTINGS, elevation });
      expect(sprite.pixels).toHaveLength(sprite.width * sprite.height);
      expect(sprite.pixels.filter(Boolean).length).toBeGreaterThan(12);
      expect(sprite.pixels.slice(0, sprite.width).every(pixel => pixel === null)).toBe(true);
      expect(sprite.pixels.slice(-sprite.width).every(pixel => pixel === null)).toBe(true);
      for (let y = 0; y < sprite.height; y++) {
        expect(sprite.pixels[y * sprite.width]).toBeNull();
        expect(sprite.pixels[(y + 1) * sprite.width - 1]).toBeNull();
      }
    }
  });
  it("creates distinct geometry for each supported body, hair, outfit and accessory", () => {
    for (const [key, values] of [["body", BODY_PARTS], ["hair", HAIR_PARTS], ["outfit", OUTFIT_PARTS], ["accessory", ACCESSORY_PARTS]] as const) {
      const signatures = values.map(value => DIRECTIONS.map(direction => render({ ...spec, [key]: value }, direction, 1, 32).pixels).flat().join());
      expect(new Set(signatures).size).toBe(values.length);
    }
  });
  it("bakes deterministic looping poses with different swinging limbs and front/back surfaces", () => {
    expect(render(spec, "south", -1)).toEqual(render(structuredClone(spec), "south", 3));
    expect(render(spec, "south", 1)).toEqual(render(spec, "south", 5));
    for (const direction of DIRECTIONS) expect(render(spec, direction, 1).pixels).not.toEqual(render(spec, direction, 3).pixels);
    expect(render(spec, "south", 0).pixels).not.toEqual(render(spec, "north", 0).pixels);
  });
  it("moves highlights with world light, preserves alpha under relighting and responds to the camera", () => {
    const left = render(spec, "south", 1);
    const right = render(spec, "south", 1, 24, { ...DEFAULT_VOXEL_SETTINGS, lightAzimuth: 135 });
    expect(right.pixels).not.toEqual(left.pixels);
    expect(right.pixels.map(Boolean)).toEqual(left.pixels.map(Boolean));
    expect(render(spec, "south", 1, 24, { ...DEFAULT_VOXEL_SETTINGS, elevation: 70 }).pixels.map(Boolean)).not.toEqual(left.pixels.map(Boolean));
    const noSun = { ...DEFAULT_VOXEL_SETTINGS, sunlight: 0 };
    expect(render(spec, "east", 0, 24, { ...noSun, lightAzimuth: 0 })).toEqual(render(spec, "east", 0, 24, { ...noSun, lightAzimuth: 180 }));
  });
  it("reports rasterized triangles and recolours the same model", () => {
    const original = render(spec, "south", 0);
    const changed = render({ ...spec, colors: { ...spec.colors, clothing: "#ffffff" } }, "south", 0);
    expect(changed.pixels).not.toEqual(original.pixels);
    expect(changed.pixels.map(Boolean)).toEqual(original.pixels.map(Boolean));
    expect(original.triangles).toBeGreaterThan(0);
    expect(original.calls).toBe(1);
  });
});
