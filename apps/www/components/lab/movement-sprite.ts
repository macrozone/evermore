import { movementFrame, type MovementState } from "@evermore/core";

/** Renderer-neutral, four-frame placeholder. Coordinates are logical pixels. */
export function movementSprite(state: MovementState) {
  const frame = movementFrame(state);
  const stride = state.moving ? [0, 2, 0, -2][frame]! : 0;
  const north = state.facing.includes("north");
  const west = state.facing.includes("west");
  const east = state.facing.includes("east");
  return [
    { x: -5, y: -12, width: 10, height: 9, color: 0xeee0a7 },
    { x: -4, y: -20, width: 8, height: 8, color: 0xd8956b },
    { x: -5, y: -22, width: 10, height: north ? 8 : 4, color: 0x452e2b },
    { x: -4, y: -3 + stride, width: 3, height: 4, color: 0x452e2b },
    { x: 1, y: -3 - stride, width: 3, height: 4, color: 0x452e2b },
    ...(!north ? [{ x: west ? -4 : east ? 3 : -2, y: -16, width: 2, height: 2, color: 0x172b26 }] : []),
  ];
}
