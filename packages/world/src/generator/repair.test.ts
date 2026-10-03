import { describe, expect, it } from "vitest";
import { WORLD_EXAMPLES } from "./examples";
import { repairWorldSpecification } from "./repair";
import { WORLD_SPECIFICATION_SCHEMA, WorldSpecificationSchema, parseWorldSpecification, worldSpecificationError } from "./specification";

const example = () => structuredClone(WORLD_EXAMPLES[0]!);
describe("world specification schema", () => {
  it("exports required fields, numeric limits and palette rules from Zod", () => {
    const schema = WORLD_SPECIFICATION_SCHEMA;
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toContain("spawn");
    expect(schema.properties?.palette).toMatchObject({ maxItems: 8, items: { pattern: "^#[0-9a-fA-F]{6}$" } });
    expect(schema.properties?.size).toMatchObject({ properties: { width: { minimum: 24, maximum: 128 } } });
    WORLD_EXAMPLES.forEach(spec => expect(WorldSpecificationSchema.safeParse(spec).success).toBe(true));
  });
  it("reports a path and geometry rule", () => {
    const spec = example(); spec.spawn = { ...spec.settlement.buildings[0]! };
    const result = WorldSpecificationSchema.safeParse(spec);
    expect(result.success).toBe(false);
    if (!result.success) expect(worldSpecificationError(result.error)).toContain("$.spawn: Spawn overlaps building");
  });
});
describe("world repair", () => {
  it("normalizes known colors and discards unknown entries without changing semantics", () => {
    const spec = { ...example(), palette: ["ForestGreen", "#abc", " #FF0000 ", "warm moonlight", null] };
    const original = structuredClone(spec);
    const result = repairWorldSpecification(spec);
    expect(result.specification.palette).toEqual(["#228b22", "#aabbcc", "#ff0000"]);
    expect(result.specification.name).toBe(spec.name);
    expect(result.repairs).toHaveLength(5);
    expect(spec).toEqual(original);
  });
  it("moves buildings, landmarks and spawn, preserving their names and floors", () => {
    const spec = example();
    spec.size.height = 16; spec.terrain.relief = 6;
    spec.settlement.buildings = [{ name: "My refuge", x: 100, y: -10, width: 10, depth: 10, floors: 4 }, { name: "Workshop", x: 100, y: -10, width: 10, depth: 10, floors: 2 }];
    spec.landmarks = [{ name: "A stone", x: 500, y: -1 }];
    spec.spawn = { x: 100, y: -10 };
    const a = repairWorldSpecification(spec), b = repairWorldSpecification(spec);
    expect(a).toEqual(b);
    expect(() => parseWorldSpecification(a.specification)).not.toThrow();
    expect(a.specification.settlement.buildings.map(b => [b.name, b.floors])).toEqual([["My refuge", 4], ["Workshop", 2]]);
    expect(a.repairs.some(r => r.startsWith("$.spawn:"))).toBe(true);
  });
  it("leaves valid specifications unchanged", () => {
    for (const spec of WORLD_EXAMPLES) expect(repairWorldSpecification(spec)).toEqual({ specification: spec, repairs: [] });
  });
  it.each([{}, { ...example(), biome: "invented" }, { ...example(), size: { width: NaN, depth: 64, height: 32 } }])("does not invent missing or unsupported semantics", value => {
    expect(() => repairWorldSpecification(value)).toThrow();
  });
  it("rejects buildings that cannot fit with the required spacing", () => {
    const spec = example(); spec.size.width = 24; spec.size.depth = 24;
    spec.settlement.buildings = Array.from({ length: 24 }, (_, i) => ({ name: `House ${i}`, x: 1, y: 1, width: 20, depth: 20, floors: 1 }));
    expect(() => repairWorldSpecification(spec)).toThrow("$.settlement.buildings[1]: No free position");
  });
});
