import type { MovementInput, MovementPosition } from "@evermore/core";
import { M, MAX_STEP_HEIGHT, PLAYER_HEIGHT, type World } from "@evermore/world";

export const PLAYER_RADIUS = 0.22;
export const DEFAULT_FOLLOW = 10;

/** Check every cell touched by the feet AABB, including support and body clearance. */
export function voxelMovementFloor(world: World, position: MovementPosition): number | null {
  const cells: { x: number; y: number; floor: number }[] = [];
  for (let y = Math.floor(position.y - PLAYER_RADIUS); y <= Math.floor(position.y + PLAYER_RADIUS - 1e-9); y++) {
    for (let x = Math.floor(position.x - PLAYER_RADIUS); x <= Math.floor(position.x + PLAYER_RADIUS - 1e-9); x++) {
      const floor = world.heightAt(x, y, position.z + MAX_STEP_HEIGHT);
      if (Math.abs(floor - position.z) > MAX_STEP_HEIGHT || !world.isWalkable(x, y, floor)) return null;
      cells.push({ x, y, floor });
    }
  }
  // Rising as soon as the AABB meets a stair, and descending after it clears
  // the riser, keeps the body outside solid geometry throughout the transition.
  const height = Math.max(...cells.map((cell) => cell.floor));
  // A one-cell rise must belong to a stair transition or the bridge approach.
  // Walkable material alone must not turn rocks or stacked terrain into stairs.
  if (height > position.z && !cells.some(({ x, y, floor }) =>
    world.getCell(x, y, floor - 1) === M.stairs
    || world.structuresAt(x, y, floor).some((structure) => structure.kind === "bridge"))) return null;
  for (const { x, y } of cells) {
    for (let z = height; z < height + PLAYER_HEIGHT; z++) {
      if (!world.inBounds(x, y, z) || world.isSolid(x, y, z) || world.getCell(x, y, z) === M.leaves) return null;
    }
  }
  return height;
}

/** Recover a bad spawn/overlap to the nearest free feet position, never a roof. */
export function nearestVoxelPosition(world: World, position: MovementPosition): MovementPosition {
  const floor = voxelMovementFloor(world, position);
  if (floor !== null) return { ...position, z: floor };
  let nearest: MovementPosition | undefined;
  let distance = Infinity;
  for (let y = 0; y < world.depth; y++) {
    for (let x = 0; x < world.width; x++) {
      const horizontal = (x + 0.5 - position.x) ** 2 + (y + 0.5 - position.y) ** 2;
      if (horizontal >= distance) continue;
      for (let z = 1; z < world.height - PLAYER_HEIGHT + 1; z++) {
        const candidate = { x: x + 0.5, y: y + 0.5, z };
        const score = horizontal + (z - position.z) ** 2;
        if (score < distance && voxelMovementFloor(world, candidate) === z) {
          nearest = candidate;
          distance = score;
        }
      }
    }
  }
  if (!nearest) throw new Error("World has no free player position");
  return nearest;
}

/** Arrow keys follow the horizontal camera axes at every camera rotation. */
export function cameraMovement(input: MovementInput, rotation: number): MovementInput {
  const angle = rotation * Math.PI / 180;
  return { x: input.x * Math.cos(angle) - input.y * Math.sin(angle), y: input.x * Math.sin(angle) + input.y * Math.cos(angle) };
}

/** Exponential follow gives the same damping at every render frame rate. */
export function followBlend(rate: number, elapsed: number): number {
  return 1 - Math.exp(-Math.max(0, rate) * Math.max(0, elapsed));
}
