import type { MovementInput, MovementPosition } from "@evermore/core";
import { MAX_STEP_HEIGHT, PLAYER_HEIGHT, type World } from "@evermore/world";

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
  for (const { x, y } of cells) {
    for (let z = height; z < height + PLAYER_HEIGHT; z++) {
      if (!world.inBounds(x, y, z) || world.isSolid(x, y, z)) return null;
    }
  }
  return height;
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
