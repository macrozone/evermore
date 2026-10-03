import { AIR, M, World } from "@evermore/world";
import { contains, type Annotation, type Point } from "./annotations";
import { reconstruct, type Raster, type Reconstruction, type Settings, type Tile } from "./model";
import type { VisionProposal } from "./vision";

const SIN = Math.SQRT1_2; const COS = Math.SQRT1_2;
export type ProjectionMode = "relief" | "projected";
export type HeightMethod = Exclude<Settings["method"], "facade"> | "vision";
export type ComparisonSettings = Omit<Settings, "method"> & { method: HeightMethod; projection: ProjectionMode; useAnchors: boolean };
export type Sample = { source: Point; ground: Point; height: number; level: number; region: string; errorPx: number };
export type Metrics = { meanProjectionErrorPx: number; maxProjectionErrorPx: number; collisions: number; unknown: number; maskIoU: Record<string, number | null>; heightErrors: { id: string; expected: number; actual: number; error: number }[] };
export type Comparison = { result: Reconstruction; samples: Sample[]; metrics: Metrics };
export function screenToGround(y: number, height: number): number { return (y + height * SIN) / COS; }
export function groundToScreen(y: number, height: number): number { return y * COS - height * SIN; }

export function compare(source: Raster, settings: ComparisonSettings, annotations: Annotation[], map?: Raster, vision?: VisionProposal): Comparison {
  const baseline = reconstruct(source, { ...settings, method: settings.method === "vision" ? "heuristic" : settings.method }, map);
  if (settings.method === "vision" && (!vision || vision.width !== source.width || vision.height !== source.height || vision.tileSize !== settings.tileSize)) throw new Error("Vision tiles require their original source and grid (64px for cached samples).");
  const imageTiles: Tile[] = baseline.tiles.map((tile, i) => {
    const proposal = settings.method === "vision" ? vision!.tiles[i]! : undefined;
    const material = proposal?.region === "water" ? M.water : proposal?.region === "roof" ? M.roof : proposal?.region === "bridge" ? M.planks : proposal?.region === "wall" ? M.stone : tile.material;
    return proposal ? { ...tile, height: 1 + Math.round(proposal.level / 5 * settings.heightScale), level: proposal.level, material } : tile;
  });
  const samples: Sample[] = []; const size = settings.tileSize;
  let collisions = 0; let unknown = 0;
  const rows = settings.projection === "relief" ? baseline.rows : Math.ceil(screenToGround(source.height / size, settings.heightScale + 1)) + 1;
  const tiles: Tile[] = Array.from({ length: baseline.columns * rows }, () => ({ height: 0, material: AIR, color: 0, level: 0 }));
  const occupied = new Set<number>();
  for (let y = 0; y < baseline.rows; y++) for (let x = 0; x < baseline.columns; x++) {
    const index = x + y * baseline.columns;
    // The partial edge tile has its actual pixel centre, not an off-image centre.
    const sx = (x * size + Math.min((x + 1) * size, source.width)) / 2;
    const sy = (y * size + Math.min((y + 1) * size, source.height)) / 2;
    const region = annotations.find((a) => contains(a.polygon, [sx / source.width, sy / source.height]));
    const tile = { ...imageTiles[index]! };
    let level = settings.method === "vision" ? vision!.tiles[index]!.level : tile.level;
    const anchored = settings.useAnchors && region && settings.projection === "projected";
    const kind = anchored ? region.kind : settings.method === "vision" ? vision!.tiles[index]!.region : region?.kind ?? "other";
    if (kind === "unknown") { unknown++; continue; }
    if (anchored) {
      level = region.level;
      // A facade's pixels rise above its foot. Do not extrude them as roof tiles.
      tile.height = region.kind === "wall" ? 1 + Math.min(Math.round(level / 5 * settings.heightScale), Math.max(0, Math.round((region.groundAnchor[1] * source.height - sy) / (size * SIN)))) : 1 + Math.round(level / 5 * settings.heightScale);
      tile.material = region.kind === "water" ? M.water : region.kind === "roof" ? M.roof : region.kind === "bridge" ? M.planks : M.stone;
    }
    tile.level = level;
    const height = tile.height;
    const correctedY = anchored ? sy + (region.groundAnchor[1] - region.baseAnchor[1]) * source.height : sy;
    const targetY = anchored && region.kind === "wall" ? screenToGround(region.groundAnchor[1] * source.height / size, 1) : screenToGround(correctedY / size, height);
    const gy = settings.projection === "relief" ? y : Math.max(0, Math.min(rows - 1, Math.round(targetY - .5)));
    const position = x + gy * baseline.columns;
    if (occupied.has(position)) collisions++;
    // Keep the upper observed surface on overlap. Lower layers are unresolved.
    if (!occupied.has(position) || tiles[position]!.height < height) tiles[position] = tile;
    occupied.add(position);
    const errorPx = Math.abs(groundToScreen(gy + .5, height) * size - sy);
    samples.push({ source: [sx / source.width, sy / source.height], ground: [x, gy], height, level, region: region?.id ?? kind, errorPx });
  }
  const world = new World({ width: baseline.columns, depth: rows, height: settings.heightScale + 4, name: `${settings.projection}: observed surface shell`, spawn: { x: 0, y: 0, z: 0 } });
  let cells = 0;
  for (const position of occupied) {
    const x = position % baseline.columns; const y = Math.floor(position / baseline.columns); const tile = tiles[position]!;
    const south = tiles[x + (y + 1) * baseline.columns]?.height ?? 0;
    // Gaps after reprojection are unknown. Never grow a facade through them.
    const bottom = settings.projection === "relief" || south > 0 ? Math.min(tile.height - 1, south) : tile.height - 1;
    for (let z = bottom; z < tile.height; z++) { world.setCell(x, y, z, tile.material); cells++; }
  }
  // Collapsed facade samples still carry observed wall cells at several heights.
  // Preserve those cells rather than treating the tallest sample as a full column.
  if (settings.projection === "projected" && settings.useAnchors) {
    for (const sample of samples) {
      if (annotations.find(a => a.id === sample.region)?.kind !== "wall") continue;
      const [x, y] = sample.ground; const z = sample.height - 1;
      if (world.getCell(x, y, z) === AIR) { world.setCell(x, y, z, M.stone); cells++; }
    }
  }
  const maskIoU: Metrics["maskIoU"] = {};
  for (const annotation of annotations) {
    let intersection = 0; let union = 0;
    const xs = annotation.polygon.map(p => p[0]); const ys = annotation.polygon.map(p => p[1]);
    for (let y = 0; y < baseline.rows; y++) for (let x = 0; x < baseline.columns; x++) {
      const p: Point = [(x * size + Math.min((x + 1) * size, source.width)) / 2 / source.width, (y * size + Math.min((y + 1) * size, source.height)) / 2 / source.height];
      // Limit evaluation to the annotated patch + one tile; other instances are unlabelled.
      if (p[0] < Math.min(...xs) - size / source.width || p[0] > Math.max(...xs) + size / source.width || p[1] < Math.min(...ys) - size / source.height || p[1] > Math.max(...ys) + size / source.height) continue;
      const hand = contains(annotation.polygon, p); const predicted = vision?.tiles[x + y * baseline.columns]?.region === annotation.kind;
      if (hand && predicted) intersection++;
      if (hand || predicted) union++;
    }
    maskIoU[annotation.id] = vision && vision.tileSize === size && union > 0 ? intersection / union : null;
  }
  const errors = samples.map(s => s.errorPx);
  const heightErrors = annotations.map(a => {
    const x = Math.min(baseline.columns - 1, Math.floor(a.probe[0] * source.width / size)); const y = Math.min(baseline.rows - 1, Math.floor(a.probe[1] * source.height / size));
    const actual = imageTiles[x + y * baseline.columns]!.level;
    return { id: a.id, expected: a.level, actual, error: Math.abs(a.level - actual) };
  });
  return { result: { world, tiles, columns: baseline.columns, rows, cells }, samples, metrics: { meanProjectionErrorPx: errors.reduce((a,b) => a+b, 0) / Math.max(1, errors.length), maxProjectionErrorPx: Math.max(0, ...errors), collisions, unknown, maskIoU, heightErrors } };
}
