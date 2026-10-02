import { MAX_STEP_HEIGHT, PLAYER_HEIGHT, getMaterial, type Vec3, type World } from "@evermore/world";

export const TILE = 20;
export const RISE = 6;
export type Layer = "ground" | "objects" | "overhead";
export interface Tile { x: number; y: number; z: number; material: number; layer: Layer }

/** Orthogonal SNES-style view: x/y stay on a grid, elevation offsets screen y. */
export function project(position: Vec3) {
  return { x: position.x * TILE, y: position.y * TILE - position.z * RISE };
}

/** One cardinal step, choosing only a reachable floor, never the roof above it. */
export function stepPlayer(world: World, position: Vec3, dx: number, dy: number): Vec3 {
  if (Math.abs(dx) + Math.abs(dy) !== 1) return position;
  const x = position.x + dx;
  const y = position.y + dy;
  for (const dz of [0, MAX_STEP_HEIGHT, -MAX_STEP_HEIGHT]) {
    const z = position.z + dz;
    if (world.isWalkable(x, y, z)) return { x, y, z };
  }
  return position;
}

/** Extract visible column surfaces. The world itself is never flattened or edited. */
export function columnTiles(world: World, x: number, y: number, player: Vec3, cutaway: boolean): Tile[] {
  let ceiling = world.height;
  if (cutaway) {
    const building = world.structuresAt(player.x, player.y, player.z).find((s) => s.kind === "building");
    if (building && x >= building.bounds.min.x - 1 && x <= building.bounds.max.x && y >= building.bounds.min.y - 1 && y <= building.bounds.max.y) {
      ceiling = player.z + PLAYER_HEIGHT;
    }
  }
  const tiles: Tile[] = [];
  // Collapse contiguous equal cells to a single tile at their upper surface.
  for (let z = 0; z < ceiling; z++) {
    const id = world.getCell(x, y, z);
    if (id === 0 || (z + 1 < ceiling && world.getCell(x, y, z + 1) === id)) continue;
    const material = getMaterial(id);
    const above = world.getMaterial(x, y, z + 1);
    if (above.opaque && !material.occludesPlayer && z + 1 < ceiling) continue;
    tiles.push({ x, y, z: z + 1, material: id, layer: material.occludesPlayer ? "overhead" : material.walkable || material.key === "water" ? "ground" : "objects" });
  }
  return tiles;
}

export function overlapsPlayer(tile: Tile, player: Vec3): boolean {
  if (tile.z <= player.z) return false;
  const top = project(tile);
  const feet = project({ x: player.x + 0.5, y: player.y + 0.5, z: player.z });
  return feet.x >= top.x && feet.x < top.x + TILE && feet.y >= top.y - TILE && feet.y - TILE < top.y + TILE;
}
