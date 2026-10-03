import { M, World, type MaterialId } from "@evermore/world";

export type Raster = { width: number; height: number; data: Uint8ClampedArray };
export type Method = "heuristic" | "heightmap" | "facade";
export type Settings = { tileSize: number; heightScale: number; method: Method };
export type Tile = { height: number; material: MaterialId; color: number; level: number };
export type Reconstruction = { world: World; tiles: Tile[]; columns: number; rows: number; cells: number; unresolvedFacades?: number; cellColors?: Map<string, number> };

function validateRaster(raster: Raster) {
  if (!Number.isInteger(raster.width) || !Number.isInteger(raster.height) || raster.width < 1 || raster.height < 1 || raster.width > 2048 || raster.height > 2048 || raster.data.length !== raster.width * raster.height * 4) {
    throw new Error("Expected an RGBA raster of at most 2048 × 2048 pixels.");
  }
}

// Median suppresses isolated highlights; no claim of semantic segmentation.
function sample(raster: Raster, x: number, y: number, size: number): [number, number, number] {
  const channels: number[][] = [[], [], []];
  for (let py = y; py < Math.min(y + size, raster.height); py++) {
    for (let px = x; px < Math.min(x + size, raster.width); px++) {
      const offset = (px + py * raster.width) * 4;
      for (let c = 0; c < 3; c++) channels[c]!.push(raster.data[offset + c]!);
    }
  }
  return channels.map((values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]!) as [number, number, number];
}

function classify([r, g, b]: [number, number, number]): { material: MaterialId; level: number } {
  if (b > r * 1.15 && b > g * 0.95) return { material: M.water, level: 0 };
  if (g > r * 1.12 && g > b * 1.1) return { material: M.grass, level: 1 };
  if (r > g * 1.3 && r > b * 1.4) return { material: M.roof, level: 4 };
  if (r > b * 1.4 && g > b * 1.15) return { material: M.planks, level: 2 };
  return { material: M.stone, level: 1 };
}

/** Image-space relief, not inferred ground coordinates or a playable scene. */
export function reconstruct(source: Raster, settings: Settings, heightmap?: Raster, facade?: Raster): Reconstruction {
  validateRaster(source);
  if (!Number.isInteger(settings.tileSize) || settings.tileSize < 8 || settings.tileSize > 128 || !Number.isInteger(settings.heightScale) || settings.heightScale < 0 || settings.heightScale > 12) throw new Error("Invalid tile size or height scale.");
  if (settings.method !== "heuristic" && settings.method !== "heightmap" && settings.method !== "facade") throw new Error("Unknown reconstruction method.");
  if (settings.method === "heightmap" || settings.method === "facade") {
    if (!heightmap) throw new Error("Choose a matching heightmap first.");
    validateRaster(heightmap);
    if (heightmap.width !== source.width || heightmap.height !== source.height) throw new Error("Heightmap and source must have identical dimensions.");
  }
  if (settings.method === "facade") {
    if (!facade) throw new Error("Choose a matching facade mask first.");
    validateRaster(facade);
    if (facade.width !== source.width || facade.height !== source.height) throw new Error("Facade mask and source must have identical dimensions.");
  }
  const columns = Math.ceil(source.width / settings.tileSize);
  const rows = Math.ceil(source.height / settings.tileSize);
  const tiles: Tile[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const rgb = sample(source, x * settings.tileSize, y * settings.tileSize, settings.tileSize);
      const { material, level } = classify(rgb);
      const gray = heightmap && settings.method !== "heuristic" ? sample(heightmap, x * settings.tileSize, y * settings.tileSize, settings.tileSize)[0] : undefined;
      // The existing model map is grayscale. Snap to six levels before scaling.
      const quantized = gray === undefined ? level : Math.round(gray / 51);
      tiles.push({ height: 1 + Math.round(quantized / 5 * settings.heightScale), level: quantized, material, color: rgb[0] * 65536 + rgb[1] * 256 + rgb[2] });
    }
  }
  if (settings.method === "facade") return reconstructFacades(facade!, settings, tiles, columns, rows);
  const world = new World({ width: columns, depth: rows, height: settings.heightScale + 4, name: "Image-space relief (incomplete shell)", spawn: { x: 0, y: 0, z: 0 } });
  let cells = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const tile = tiles[x + y * columns]!;
      // Only the observed top and its south-facing facade. Leave interiors,
      // north walls and side walls unknown/air, even in the exported world.
      const south = tiles[x + (y + 1) * columns]?.height ?? 0;
      const bottom = Math.min(tile.height - 1, south);
      for (let z = bottom; z < tile.height; z++) { world.setCell(x, y, z, tile.material); cells++; }
    }
  }
  return { world, tiles, columns, rows, cells };
}

/** Vertical mask runs have one ground anchor, rather than independent terrain columns. */
function reconstructFacades(facade: Raster, settings: Settings, tiles: Tile[], columns: number, rows: number): Reconstruction {
  const vertical = tiles.map((_, index) => sample(facade, index % columns * settings.tileSize, Math.floor(index / columns) * settings.tileSize, settings.tileSize)[0] >= 128);
  const world = new World({ width: columns, depth: rows + settings.heightScale + 2, height: settings.heightScale + 4, name: "Top surfaces and anchored facades (incomplete shell)", spawn: { x: 0, y: 0, z: 0 } });
  const cellColors = new Map<string, number>();
  let unresolvedFacades = 0;
  const put = (x: number, y: number, z: number, tile: Tile) => {
    world.setCell(x, y, z, tile.material); cellColors.set(`${x},${y},${z}`, tile.color);
  };
  // At 45 degrees screenY = groundY - height. Undo that shift for tops.
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const index = x + y * columns, tile = tiles[index]!;
    if (!vertical[index]) put(x, y + tile.height - 1, tile.height - 1, tile);
  }
  for (let x = 0; x < columns; x++) {
    for (let y = 0; y < rows; y++) {
      if (!vertical[x + y * columns]) continue;
      const start = y;
      while (y + 1 < rows && vertical[x + (y + 1) * columns]) y++;
      const end = y;
      const above = start > 0 ? tiles[x + (start - 1) * columns] : undefined;
      const below = end + 1 < rows ? tiles[x + (end + 1) * columns] : undefined;
      if (!above || !below || above.height <= below.height) { unresolvedFacades++; continue; }
      const low = below.height - 1, high = above.height - 1;
      const anchor = end + 1 + low;
      // Every cell from the ground to the eave shares the same ground coordinate.
      // Source colour is sampled linearly down the mask, never used for height.
      for (let z = low; z <= high; z++) {
        const fraction = (high - z) / (high - low);
        const imageRow = start + Math.round(fraction * (end - start));
        put(x, anchor, z, tiles[x + imageRow * columns]!);
      }
      // Close the observed roof/wall junction without inventing hidden interiors.
      const roofRow = start - 1 + high;
      for (let row = Math.min(roofRow, anchor); row <= Math.max(roofRow, anchor); row++) put(x, row, high, above);
      for (let imageRow = start; imageRow <= end; imageRow++) tiles[x + imageRow * columns]!.height = 1 + Math.round(high - (imageRow - start) / Math.max(1, end - start) * (high - low));
    }
  }
  return { world, tiles, columns, rows, cells: cellColors.size, unresolvedFacades, cellColors };
}
