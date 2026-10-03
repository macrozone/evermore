import { z } from "zod";

const integer = (min: number, max: number) => z.int().min(min).max(max);
const name = z.string().min(1).max(120);
const point = { x: integer(1, 127), y: integer(1, 127) };

/** Single source for the versioned type, producer schema and local validation. */
export const WorldSpecificationFields = z.strictObject({
  version: z.literal(1), name,
  biome: z.enum(["forest", "coast", "desert", "mountain"]),
  climate: z.enum(["temperate", "dry", "cold"]),
  timeOfDay: z.enum(["day", "dusk", "night"]),
  mood: z.string().max(200),
  palette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected a six-digit hex color")).max(8),
  size: z.strictObject({ width: integer(24, 128), depth: integer(24, 128), height: integer(16, 64) }),
  terrain: z.strictObject({ elevation: integer(1, 8), relief: integer(0, 6), scale: integer(4, 32) }),
  water: z.strictObject({ kind: z.enum(["none", "river", "sea"]), level: integer(1, 8) }),
  vegetation: z.strictObject({ density: z.number().min(0).max(0.3) }),
  settlement: z.strictObject({ buildings: z.array(z.strictObject({
    name, ...point, width: integer(8, 20), depth: integer(8, 20), floors: integer(1, 4),
  })).max(24) }),
  paths: z.boolean(),
  landmarks: z.array(z.strictObject({ name, ...point })).max(16),
  spawn: z.strictObject(point),
});
export type WorldSpecification = z.infer<typeof WorldSpecificationFields>;
type Building = WorldSpecification["settlement"]["buildings"][number];
export const buildingsOverlap = (a: Building, b: Building) =>
  a.x - 2 < b.x + b.width && a.x + a.width + 2 > b.x && a.y - 2 < b.y + b.depth && a.y + a.depth + 2 > b.y;
export const spawnOverlapsBuilding = (spawn: WorldSpecification["spawn"], b: Building) =>
  spawn.x >= b.x - 1 && spawn.x <= b.x + b.width && spawn.y >= b.y - 1 && spawn.y <= b.y + b.depth;

/** Cross-field rules cannot be expressed by the provider's JSON Schema. */
export const WorldSpecificationSchema = WorldSpecificationFields.superRefine((spec, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  const { width, depth, height } = spec.size;
  const base = Math.max(spec.terrain.elevation, spec.water.level + 1);
  if (base + spec.terrain.relief + 6 >= height) issue(["size", "height"], "Terrain exceeds world height");
  if (spec.spawn.x >= width - 1 || spec.spawn.y >= depth - 1) issue(["spawn"], "Spawn outside world");
  spec.landmarks.forEach((landmark, i) => {
    if (landmark.x >= width - 1 || landmark.y >= depth - 1) issue(["landmarks", i], "Landmark outside world");
    if (landmark.x === spec.spawn.x && landmark.y === spec.spawn.y) issue(["landmarks", i], "Landmark overlaps spawn");
  });
  spec.settlement.buildings.forEach((b, i) => {
    if (b.x + b.width >= width - 1 || b.y + b.depth >= depth - 1 || base + b.floors * 4 + 2 >= height) issue(["settlement", "buildings", i], "Building exceeds world bounds");
    if (spawnOverlapsBuilding(spec.spawn, b)) issue(["spawn"], "Spawn overlaps building");
    if (spec.settlement.buildings.slice(0, i).some(other => buildingsOverlap(b, other))) issue(["settlement", "buildings", i], "Buildings overlap");
  });
});

/** Draft 2020-12 schema, generated from Zod; geometry remains locally enforced. */
export const WORLD_SPECIFICATION_SCHEMA = z.toJSONSchema(WorldSpecificationSchema);
export function worldSpecificationError(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues.map(issue => {
    const path = issue.path.reduce<string>((path, part) => typeof part === "number" ? `${path}[${part}]` : `${path}.${String(part)}`, "$");
    return `${path}: ${issue.message}`;
  }).join("; ");
  if (error instanceof RangeError) return error.message;
  return "$: Expected a complete JSON world specification";
}
export function parseWorldSpecification(value: unknown): WorldSpecification {
  const result = WorldSpecificationSchema.safeParse(value);
  if (!result.success) throw new TypeError(`Invalid world specification at ${worldSpecificationError(result.error)}`);
  return result.data;
}
