/** Versioned semantic input; coordinates and dimensions are integer cells. */
export interface WorldSpecification {
  version: 1;
  name: string;
  biome: "forest" | "coast" | "desert" | "mountain";
  climate: "temperate" | "dry" | "cold";
  timeOfDay: "day" | "dusk" | "night";
  mood: string;
  palette: string[];
  size: { width: number; depth: number; height: number };
  terrain: { elevation: number; relief: number; scale: number };
  water: { kind: "none" | "river" | "sea"; level: number };
  vegetation: { density: number };
  settlement: { buildings: { name: string; x: number; y: number; width: number; depth: number; floors: number }[] };
  paths: boolean;
  landmarks: { name: string; x: number; y: number }[];
  spawn: { x: number; y: number };
}

const integer = (minimum: number, maximum: number) => ({ type: "integer", minimum, maximum });
const object = (properties: Record<string, Schema>) => ({
  type: "object", additionalProperties: false, required: Object.keys(properties), properties,
});
/** Draft 2020-12 schema for producers (including future LLM adapters). */
export const WORLD_SPECIFICATION_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://evermore.game/schemas/world-specification-v1.json",
  ...object({
    version: { const: 1 }, name: { type: "string", minLength: 1, maxLength: 120 },
    biome: { enum: ["forest", "coast", "desert", "mountain"] },
    climate: { enum: ["temperate", "dry", "cold"] },
    timeOfDay: { enum: ["day", "dusk", "night"] },
    mood: { type: "string", maxLength: 200 },
    palette: { type: "array", maxItems: 8, items: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" } },
    size: object({ width: integer(24, 128), depth: integer(24, 128), height: integer(16, 64) }),
    terrain: object({ elevation: integer(1, 8), relief: integer(0, 6), scale: integer(4, 32) }),
    water: object({ kind: { enum: ["none", "river", "sea"] }, level: integer(1, 8) }),
    vegetation: object({ density: { type: "number", minimum: 0, maximum: 0.3 } }),
    settlement: object({ buildings: { type: "array", maxItems: 24, items: object({
      name: { type: "string", minLength: 1, maxLength: 120 },
      x: integer(1, 127), y: integer(1, 127),
      width: integer(8, 20), depth: integer(8, 20), floors: integer(1, 4),
    }) } }),
    paths: { type: "boolean" },
    landmarks: { type: "array", maxItems: 16, items: object({
      name: { type: "string", minLength: 1, maxLength: 120 }, x: integer(1, 127), y: integer(1, 127),
    }) },
    spawn: object({ x: integer(1, 127), y: integer(1, 127) }),
  }),
} as const;

type Schema = { type?: string; const?: unknown; enum?: readonly unknown[]; minimum?: number; maximum?: number; minLength?: number; maxLength?: number; pattern?: string; maxItems?: number; items?: Schema; properties?: Record<string, Schema> };
/** Validate before allocation. Cross-field constraints protect buildings and spawn. */
export function parseWorldSpecification(value: unknown): WorldSpecification {
  function check(input: unknown, schema: Schema, path: string): void {
    const fail = () => { throw new TypeError(`Invalid world specification at ${path}`); };
    if ("const" in schema && input !== schema.const) fail();
    if (schema.enum && !schema.enum.includes(input)) fail();
    if (schema.type === "object") {
      if (input === null || typeof input !== "object" || Array.isArray(input)) fail();
      const record = input as Record<string, unknown>;
      for (const key of Object.keys(record)) if (!(key in schema.properties!)) fail();
      for (const [key, child] of Object.entries(schema.properties!)) check(record[key], child, `${path}.${key}`);
    }
    if (schema.type === "array") {
      if (!Array.isArray(input) || input.length > schema.maxItems!) fail();
      (input as unknown[]).forEach((item, i) => check(item, schema.items!, `${path}[${i}]`));
    }
    if (schema.type === "string") {
      if (typeof input !== "string" || input.length < (schema.minLength ?? 0) || input.length > schema.maxLength! || (schema.pattern !== undefined && !new RegExp(schema.pattern).test(input))) fail();
    }
    if (schema.type === "boolean" && typeof input !== "boolean") fail();
    if (schema.type === "number" || schema.type === "integer") {
      if (typeof input !== "number" || !Number.isFinite(input) || (schema.type === "integer" && !Number.isInteger(input)) || input < schema.minimum! || input > schema.maximum!) fail();
    }
  }
  check(value, WORLD_SPECIFICATION_SCHEMA, "$");
  const spec = value as WorldSpecification;
  const { width, depth, height } = spec.size;
  const base = Math.max(spec.terrain.elevation, spec.water.level + 1);
  if (base + spec.terrain.relief + 6 >= height) throw new RangeError("Terrain exceeds world height");
  const inside = (x: number, y: number) => x < width - 1 && y < depth - 1;
  if (!inside(spec.spawn.x, spec.spawn.y)) throw new RangeError("Spawn outside world");
  for (const landmark of spec.landmarks) if (!inside(landmark.x, landmark.y)) throw new RangeError("Landmark outside world");
  for (const [i, b] of spec.settlement.buildings.entries()) {
    if (b.x + b.width >= width - 1 || b.y + b.depth >= depth - 1 || base + b.floors * 4 + 2 >= height) throw new RangeError("Building exceeds world bounds");
    if (spec.spawn.x >= b.x - 1 && spec.spawn.x <= b.x + b.width && spec.spawn.y >= b.y - 1 && spec.spawn.y <= b.y + b.depth) throw new RangeError("Spawn overlaps building");
    for (const other of spec.settlement.buildings.slice(0, i)) {
      if (b.x - 2 < other.x + other.width && b.x + b.width + 2 > other.x && b.y - 2 < other.y + other.depth && b.y + b.depth + 2 > other.y) throw new RangeError("Buildings overlap");
    }
  }
  return spec;
}
