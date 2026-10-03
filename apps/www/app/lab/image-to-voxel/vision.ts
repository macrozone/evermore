export const REGIONS = ["roof", "wall", "bridge", "water", "other", "unknown"] as const;
export type RegionKind = typeof REGIONS[number];
export type VisionTile = { x: number; y: number; level: number; region: RegionKind };
export type VisionProposal = { sourceId: string; width: number; height: number; tileSize: number; tiles: VisionTile[] };
export const VISION_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["sourceId", "width", "height", "tileSize", "tiles"],
  properties: {
    sourceId: { type: "string" }, width: { type: "integer" }, height: { type: "integer" }, tileSize: { type: "integer" },
    tiles: { type: "array", items: { type: "object", additionalProperties: false, required: ["x", "y", "level", "region"], properties: {
      x: { type: "integer" }, y: { type: "integer" }, level: { type: "integer", minimum: 0, maximum: 5 }, region: { type: "string", enum: REGIONS },
    } } },
  },
} as const;

/** Schema shape is insufficient: also enforce identity, coverage and water/deck rules. */
export function parseVisionProposal(value: unknown, expected: Omit<VisionProposal, "tiles">): VisionProposal {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a vision proposal object.");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["sourceId", "width", "height", "tileSize", "tiles"].includes(key))) throw new Error("Unexpected proposal fields.");
  for (const key of ["sourceId", "width", "height", "tileSize"] as const) {
    if (input[key] !== expected[key]) throw new Error(`Vision proposal ${key} does not match this source / grid.`);
  }
  if (!Number.isInteger(expected.tileSize) || expected.tileSize < 8 || expected.tileSize > 128 || !Number.isInteger(expected.width) || !Number.isInteger(expected.height) || expected.width < 1 || expected.height < 1 || expected.width > 2048 || expected.height > 2048) throw new Error("Invalid expected grid.");
  const columns = Math.ceil(expected.width / expected.tileSize); const rows = Math.ceil(expected.height / expected.tileSize);
  if (!Array.isArray(input.tiles) || input.tiles.length !== columns * rows) throw new Error("Vision proposal must cover every tile exactly once.");
  const tiles: VisionTile[] = []; const seen = new Set<number>();
  for (const item of input.tiles) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) throw new Error("Invalid vision tile.");
    const t = item as Record<string, unknown>;
    if (Object.keys(t).length !== 4 || !Number.isInteger(t.x) || !Number.isInteger(t.y) || !Number.isInteger(t.level) || !REGIONS.includes(t.region as RegionKind)) throw new Error("Invalid vision tile fields.");
    const tile = t as VisionTile;
    if (tile.x < 0 || tile.x >= columns || tile.y < 0 || tile.y >= rows || tile.level < 0 || tile.level > 5) throw new Error("Vision tile is out of bounds.");
    const index = tile.x + tile.y * columns;
    if (seen.has(index)) throw new Error("Duplicate vision tile.");
    if (tile.region === "water" && tile.level !== 0) throw new Error("Water must use level zero.");
    if (tile.region === "bridge" && tile.level < 1) throw new Error("Bridge / dock must be above water.");
    seen.add(index); tiles[index] = { ...tile };
  }
  return { ...expected, tiles };
}
