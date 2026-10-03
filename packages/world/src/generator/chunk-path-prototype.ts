import type { Vec3 } from "../geometry";
import { M } from "../materials";
import { hashSeed } from "../rng";
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, MAX_STEP_HEIGHT, PLAYER_HEIGHT, type World } from "../world";

/** Experimental terrain recipe. Coordinates are global, never chunk-local. */
export function prototypeSurface(seed: number, x: number, y: number): { top: number; water: boolean } {
  const scale = 32;
  const gx = Math.floor(x / scale), gy = Math.floor(y / scale);
  const tx = x / scale - gx, ty = y / scale - gy;
  const sample = (a: number, b: number) => hashSeed(`terrain-v1:${seed >>> 0}:${a}:${b}`) / 0xffffffff;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const value = lerp(lerp(sample(gx, gy), sample(gx + 1, gy), tx), lerp(sample(gx, gy + 1), sample(gx + 1, gy + 1), tx), ty);
  // A world-space river crossing chunk boundaries; deliberately simple fixture.
  const water = x >= 30 && x <= 33;
  return { top: water ? 1 : 2 + Math.round(value * 2), water };
}

/**
 * Generate one horizontal chunk column on demand. Already allocated columns
 * are left intact, including player edits. Call before placing objects/roads.
 * No unbounded-world storage or automatic generation from getCell is implied.
 */
export function generatePrototypeChunk(world: World, cx: number, cy: number): boolean {
  if (!Number.isInteger(cx) || !Number.isInteger(cy) || cx < 0 || cy < 0 || cx >= world.chunksX || cy >= world.chunksY || world.height < 6) {
    throw new RangeError("Prototype requires a valid chunk column and height >= 6");
  }
  for (let cz = 0; cz < world.chunksZ; cz++) if (world.getChunk(cx, cy, cz)) return false;
  for (let y = cy * CHUNK_SIZE_Y; y < Math.min((cy + 1) * CHUNK_SIZE_Y, world.depth); y++) {
    for (let x = cx * CHUNK_SIZE_X; x < Math.min((cx + 1) * CHUNK_SIZE_X, world.width); x++) {
      const { top, water } = prototypeSurface(world.seed, x, y);
      for (let z = 0; z < top - 1; z++) world.setCell(x, y, z, M.dirt);
      world.setCell(x, y, top - 1, water ? M.water : M.grass);
    }
  }
  return true;
}

/**
 * A* road-building experiment on loaded terrain. Preserves land elevations,
 * penalises slopes and bridges, rejects obstacles and cliffs. Water may get a
 * deck at feet z=3; no water is erased. Returns null without changes if no route
 * exists or the 20,000-expansion experiment budget is exhausted.
 * One surface per column: not an indoor/multi-storey navigation algorithm.
 */
export function connectPrototypePath(world: World, start: Vec3, goal: Vec3): Vec3[] | null {
  if (!world.isWalkable(start.x, start.y, start.z) || !world.isWalkable(goal.x, goal.y, goal.z)) return null;
  const key = (p: Vec3) => p.x + p.y * world.width;
  const surface = (x: number, y: number): Vec3 | null => {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= world.width || y >= world.depth) return null;
    const top = world.heightAt(x, y);
    if (top === 0) return null; // unloaded chunks are not traversable
    if (world.getCell(x, y, top - 1) === M.water) {
      const deck = 3;
      if (top >= deck || deck + PLAYER_HEIGHT > world.height) return null;
      for (let z = deck - 1; z < deck + PLAYER_HEIGHT; z++) if (world.isSolid(x, y, z)) return null;
      return { x, y, z: deck };
    }
    return world.isWalkable(x, y, top) ? { x, y, z: top } : null;
  };
  if (surface(start.x, start.y)?.z !== start.z || surface(goal.x, goal.y)?.z !== goal.z) return null;
  const heuristic = (p: Vec3) => Math.abs(p.x - goal.x) + Math.abs(p.y - goal.y);
  const open = new Map<number, Vec3>([[key(start), start]]);
  const costs = new Map<number, number>([[key(start), 0]]);
  const parents = new Map<number, Vec3>();
  const closed = new Set<number>();
  for (let expanded = 0; open.size > 0 && expanded < 20_000; expanded++) {
    // Linear frontier is sufficient for the bounded prototype; use a heap at scale.
    let current = open.values().next().value!;
    for (const p of open.values()) if (costs.get(key(p))! + heuristic(p) < costs.get(key(current))! + heuristic(current)) current = p;
    const id = key(current);
    open.delete(id);
    if (id === key(goal)) {
      const path = [current];
      while (parents.has(key(path[0]!))) path.unshift(parents.get(key(path[0]!))!);
      for (const p of path) {
        const water = world.getCell(p.x, p.y, world.heightAt(p.x, p.y) - 1) === M.water;
        world.setCell(p.x, p.y, p.z - 1, water ? M.planks : M.stoneFloor);
      }
      return path;
    }
    closed.add(id);
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
      const next = surface(current.x + dx, current.y + dy);
      if (!next || closed.has(key(next)) || Math.abs(next.z - current.z) > MAX_STEP_HEIGHT) continue;
      const material = world.getCell(next.x, next.y, world.heightAt(next.x, next.y) - 1);
      const cost = costs.get(id)! + 1 + Math.abs(next.z - current.z) * 3 + (material === M.water ? 8 : 0);
      if (cost >= (costs.get(key(next)) ?? Infinity)) continue;
      costs.set(key(next), cost);
      parents.set(key(next), current);
      open.set(key(next), next);
    }
  }
  return null;
}
