import { M, World, getMaterial } from "@evermore/world";

export type Raster = { width: number; height: number; data: Uint8ClampedArray };
export type Layer = "ground" | "object" | "overhead";
export type Settings = { tileSize: number; maxDistance: number; heightScale: number };
export const PALETTE = [
  { material: M.grass, color: 0x709452, layer: "ground", level: 0 },
  { material: M.dirt, color: 0x806044, layer: "ground", level: 0 },
  { material: M.sand, color: 0xc6af77, layer: "ground", level: 0 },
  { material: M.water, color: 0x405e85, layer: "ground", level: 0 },
  { material: M.stone, color: 0x929397, layer: "ground", level: 1 },
  { material: M.planks, color: 0xad8457, layer: "ground", level: 0 },
  { material: M.log, color: 0x4e382a, layer: "object", level: 2 },
  { material: M.stoneWall, color: 0x696974, layer: "object", level: 2 },
  { material: M.roof, color: 0x975348, layer: "overhead", level: 4 },
  { material: M.leaves, color: 0x344d36, layer: "overhead", level: 3 },
] as const;
export type Tile = { material: number | null; candidate: number; color: number; distance: number; margin: number; layer: Layer | null; height: number | null };
export type Analysis = { columns: number; rows: number; tiles: Tile[]; unknown: number; world: World; layers: Record<Layer, (number | null)[]> };
const rgb = (color: number) => [color >> 16, (color >> 8) & 255, color & 255];

/** Median colour ignores isolated highlights. It cannot distinguish grass from a tree. */
function sample(source: Raster, x: number, y: number, size: number) {
  const histograms = Array.from({ length: 3 }, () => new Uint32Array(256));
  let count = 0, total = 0;
  for (let py = y; py < Math.min(y + size, source.height); py++) {
    for (let px = x; px < Math.min(x + size, source.width); px++) {
      const i = (px + py * source.width) * 4;
      total++;
      if (source.data[i + 3]! < 128) continue;
      count++;
      for (let c = 0; c < 3; c++) histograms[c]![source.data[i + c]!]!++;
    }
  }
  const channels = histograms.map(histogram => {
    let accumulated = 0;
    for (let i = 0; i < 256; i++) { accumulated += histogram[i]!; if (accumulated > count / 2) return i; }
    return 0;
  });
  return { color: channels[0]! * 65536 + channels[1]! * 256 + channels[2]!, visible: count > total / 2 };
}

export function analyse(source: Raster, settings: Settings): Analysis {
  if (!Number.isInteger(source.width) || !Number.isInteger(source.height) || source.width < 1 || source.height < 1 || source.width > 2048 || source.height > 2048 || source.data.length !== source.width * source.height * 4) throw new RangeError("Expected an RGBA image of at most 2048 × 2048 pixels.");
  if (!Number.isInteger(settings.tileSize) || settings.tileSize < 8 || settings.tileSize > 128 || !Number.isFinite(settings.maxDistance) || settings.maxDistance < 0 || settings.maxDistance > 0.6 || !Number.isInteger(settings.heightScale) || settings.heightScale < 0 || settings.heightScale > 12) throw new RangeError("Invalid grid, uncertainty or height setting.");
  const columns = Math.ceil(source.width / settings.tileSize), rows = Math.ceil(source.height / settings.tileSize);
  const tiles: Tile[] = [], layers: Analysis["layers"] = { ground: [], object: [], overhead: [] };
  const world = new World({ width: columns, depth: rows, height: settings.heightScale + 4, name: "G3 observed surfaces — hidden cells unknown", spawn: { x: 0, y: 0, z: 0 } });
  let unknown = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const { color, visible } = sample(source, x * settings.tileSize, y * settings.tileSize, settings.tileSize);
    const channels = rgb(color);
    const ranked = PALETTE.map(entry => ({ entry, distance: Math.hypot(...rgb(entry.color).map((v, c) => v - channels[c]!)) / Math.sqrt(3 * 255 ** 2) })).sort((a, b) => a.distance - b.distance);
    const nearest = ranked[0]!, margin = ranked[1]!.distance - nearest.distance;
    // Near ties and transparent cells stay unknown, even at a permissive distance.
    const accepted = visible && nearest.distance <= settings.maxDistance && margin >= 0.025;
    const material = accepted ? nearest.entry.material : null;
    const layer = accepted ? nearest.entry.layer : null;
    const height = accepted ? Math.round(nearest.entry.level / 4 * settings.heightScale) : null;
    tiles.push({ material, candidate: nearest.entry.material, color, distance: nearest.distance, margin, layer, height });
    for (const key of ["ground", "object", "overhead"] as const) layers[key].push(key === layer ? material : null);
    if (material === null) unknown++;
    else world.setCell(x, y, height!, material);
  }
  return { columns, rows, tiles, unknown, world, layers };
}

export function exportAnalysis(result: Analysis, settings: Settings, provenance: unknown) {
  return { version: 1, method: "median-rgb-palette-v1", coordinates: "image-space; x east, y south; z heuristic", dimensions: { columns: result.columns, rows: result.rows }, settings, provenance,
    unknown: "null means unobserved or uncertain, never verified air. EVW stores only accepted surfaces; omitted cells are unknown, not navigable space. No valid spawn is inferred.",
    heights: "Material-based heuristic; no measured elevation, collision, interior or registration guarantee.",
    palette: PALETTE.map(entry => ({ ...entry, name: getMaterial(entry.material).key })),
    materials: result.tiles.map(tile => tile.material), heightsRaster: result.tiles.map(tile => tile.height), layers: result.layers, tiles: result.tiles };
}
