import { describe, expect, it } from "vitest";
import { ACCESSORY_PARTS, BODY_PARTS, CHARACTER_EXAMPLES, HAIR_PARTS, OUTFIT_PARTS, exampleForDescription, parseCharacterInput, parseCharacterSpecification } from "./specification";
import { DIRECTIONS, renderCharacter } from "./sprite";

const spec = CHARACTER_EXAMPLES[0]!.specification;

describe("character specifications", () => {
  it("validates every preset and normalizes colours and names", () => {
    for (const example of CHARACTER_EXAMPLES) expect(parseCharacterSpecification(example.specification)).toEqual(example.specification);
    expect(parseCharacterSpecification({ ...spec, name: "  Traveller  ", colors: { ...spec.colors, skin: "#ABCDEF" } })).toMatchObject({ name: "Traveller", colors: { skin: "#abcdef" } });
  });
  it.each([null, [], {}, { ...spec, version: 2 }, { ...spec, name: " " }, { ...spec, body: "dragon" }, { ...spec, hair: "curly" }, { ...spec, outfit: "armour" }, { ...spec, accessory: "sword" }, { ...spec, arbitrary: true }, { ...spec, colors: { ...spec.colors, skin: "red" } }, { ...spec, colors: { ...spec.colors, eyes: "#ffffff" } }])("rejects unsupported model specifications", value => {
    expect(() => parseCharacterSpecification(value)).toThrow();
  });
  it("keeps fallback examples independent of later edits", () => {
    const first = exampleForDescription("A wizard");
    first.colors.skin = "#ffffff";
    expect(exampleForDescription("A wizard")).toEqual(CHARACTER_EXAMPLES[1]!.specification);
    expect(exampleForDescription("A sailor")).toEqual(CHARACTER_EXAMPLES[2]!.specification);
  });
  it("defaults to the requested Flash-Lite text model", () => {
    expect(parseCharacterInput({ description: "  A botanist  " })).toEqual({ description: "A botanist", model: "gemini-3.5-flash-lite" });
  });
});

describe("paper doll renderer", () => {
  it("keeps every supported part combination inside the grid at each resolution and phase", () => {
    for (const density of [16, 24, 32] as const) for (const body of BODY_PARTS) for (const hair of HAIR_PARTS) for (const outfit of OUTFIT_PARTS) for (const accessory of ACCESSORY_PARTS) {
      for (const direction of DIRECTIONS) for (let frame = 0; frame < 4; frame++) {
        const sprite = renderCharacter({ ...spec, body, hair, outfit, accessory }, direction, frame, density);
        expect(sprite.pixels).toHaveLength(sprite.width * sprite.height);
        expect(sprite.pixels.some(Boolean)).toBe(true);
        // Transparent edges catch clipped hats, hair, arms and boots.
        expect(sprite.pixels.slice(0, sprite.width).every(pixel => pixel === null)).toBe(true);
        expect(sprite.pixels.slice(-sprite.width).every(pixel => pixel === null)).toBe(true);
        for (let y = 0; y < sprite.height; y++) {
          expect(sprite.pixels[y * sprite.width]).toBeNull();
          expect(sprite.pixels[(y + 1) * sprite.width - 1]).toBeNull();
        }
      }
    }
  });
  it("mirrors the entire side view, including its accessory", () => {
    const east = renderCharacter(spec, "east", 1);
    const west = renderCharacter(spec, "west", 1);
    for (let y = 0; y < east.height; y++) for (let x = 0; x < east.width; x++) {
      expect(west.pixels[y * west.width + x]).toBe(east.pixels[y * east.width + east.width - x - 1]);
    }
  });
  it("is repeatable, wraps four phases and separates the front and back", () => {
    expect(renderCharacter(spec, "south", 1)).toEqual(renderCharacter(structuredClone(spec), "south", 5));
    expect(renderCharacter(spec, "south", -1)).toEqual(renderCharacter(spec, "south", 3));
    expect(renderCharacter(spec, "south", 0)).not.toEqual(renderCharacter(spec, "north", 0));
    expect(renderCharacter(spec, "south", 1)).not.toEqual(renderCharacter(spec, "south", 3));
  });
});
