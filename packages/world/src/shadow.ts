import type { Vec3 } from "./geometry";
import { AIR, M } from "./materials";
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, World } from "./world";

/** First bed in stable z/y/x order, falling back to the world's spawn. */
export function findInfluenceOrigin(world: World): Vec3 {
  for (let z = 0; z < world.height; z++) {
    for (let y = 0; y < world.depth; y++) {
      for (let x = 0; x < world.width; x++) {
        if (world.getCell(x, y, z) === M.bed) return { x, y, z };
      }
    }
  }
  return { ...world.spawn };
}

/** Experimental horizontal linear falloff: maximum danger directly above home. */
export function influenceAt(position: Vec3, origin: Vec3, radius: number): number {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError("Influence radius must be positive and finite");
  return Math.max(0, 1 - Math.hypot(position.x - origin.x, position.y - origin.y) / radius);
}

/** Preserve topology, collision and named regions; derive material decay from seed and position. */
export function deriveShadowWorld(source: World): World {
  const result = new World({ width: source.width, depth: source.depth, height: source.height,
    seed: source.seed, name: `${source.name} (shadow)`, spawn: { ...source.spawn } });
  for (const chunk of source.chunks()) {
    for (let z = 0; z < CHUNK_SIZE_Z; z++) {
      for (let y = 0; y < CHUNK_SIZE_Y; y++) {
        for (let x = 0; x < CHUNK_SIZE_X; x++) {
          const wx = chunk.cx * CHUNK_SIZE_X + x;
          const wy = chunk.cy * CHUNK_SIZE_Y + y;
          const wz = chunk.cz * CHUNK_SIZE_Z + z;
          const material = source.getCell(wx, wy, wz);
          if (material === AIR) continue;
          const hash = (Math.imul(wx + 1, 73856093) ^ Math.imul(wy + 1, 19349663) ^ Math.imul(wz + 1, 83492791) ^ source.seed) >>> 0;
          // Already-derived or future materials remain intact.
          const shadow = material <= 20 ? 20 + material + (hash % 7 === 0 ? 20 : 0) : material;
          result.setCell(wx, wy, wz, shadow);
        }
      }
    }
  }
  for (const structure of source.structures) {
    result.addStructure({ ...structure, bounds: { min: { ...structure.bounds.min }, max: { ...structure.bounds.max } } });
  }
  return result;
}
