import { paintMasks, safeSpawn, type Masks } from "../g3b-map/model";
export type Point = { x: number; y: number };
export const CABIN_DOOR: Point = { x: 500, y: 450 };
export const CABIN_START: Point = { x: 500, y: 540 };
export function nearDoor(position: Point, door: Point) { return Math.hypot(position.x-door.x, position.y-door.y) <= 36; }
/** Explicit local threshold correction; the model output remains unchanged. */
export function doorPassage(masks: Masks, door: Point) {
  const d = { x: Math.max(16, Math.min(masks.width-16, door.x)), y: Math.max(16, Math.min(masks.height-16, door.y)) };
  const corrected = paintMasks(masks, d, { x:d.x,y:Math.min(masks.height-16,d.y+36) }, 14, "clear");
  return { masks: corrected, door: d, spawn: safeSpawn(corrected, { x:d.x,y:Math.min(masks.height-16,d.y+25) })! };
}
