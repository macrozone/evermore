/**
 * Integer cell coordinates.
 *
 * Axis convention for the whole package: x grows east, y grows south
 * (downwards on a top-down screen), z grows up.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Axis-aligned box in cell coordinates: `min` inclusive, `max` exclusive. */
export interface Box {
  min: Vec3;
  max: Vec3;
}

export function box(
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): Box {
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

export function boxContains(b: Box, x: number, y: number, z: number): boolean {
  return (
    x >= b.min.x &&
    x < b.max.x &&
    y >= b.min.y &&
    y < b.max.y &&
    z >= b.min.z &&
    z < b.max.z
  );
}

export function boxVolume(b: Box): number {
  return (
    Math.max(0, b.max.x - b.min.x) *
    Math.max(0, b.max.y - b.min.y) *
    Math.max(0, b.max.z - b.min.z)
  );
}
