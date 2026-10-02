/**
 * Material ID stored per cell (Uint16). IDs are part of the serialized
 * format: never renumber or reuse an ID, only append new ones.
 */
export type MaterialId = number;

export interface Material {
  id: MaterialId;
  /** Stable machine name, e.g. "grass". */
  key: string;
  /** Blocks movement (collision). Water is solid: it cannot be walked through. */
  solid: boolean;
  /** The top face can be stood on. Only meaningful for solid materials. */
  walkable: boolean;
  /** Fully blocks sight; neighbouring faces can be culled. */
  opaque: boolean;
  /** May hide the player (roofs, walls, tree tops) – render semi-transparent then. */
  occludesPlayer: boolean;
  /** Rendered see-through (water, glass, leaves). */
  transparent: boolean;
  /** Base colour as 0xRRGGBB. */
  color: number;
  /** Index into a placeholder tile sheet for 2D renderers. */
  tileIndex: number;
}

export const AIR: MaterialId = 0;

/** Material IDs of the default table, for readable world-building code. */
export const M = {
  air: 0,
  grass: 1,
  dirt: 2,
  stone: 3,
  sand: 4,
  water: 5,
  planks: 6,
  log: 7,
  leaves: 8,
  stoneWall: 9,
  brickWall: 10,
  roof: 11,
  glass: 12,
  stairs: 13,
  stoneFloor: 14,
} as const satisfies Record<string, MaterialId>;

type MaterialProps = Omit<Material, "id" | "key">;

const solidGround = {
  solid: true,
  walkable: true,
  opaque: true,
  occludesPlayer: false,
  transparent: false,
} as const;

const wall = {
  solid: true,
  walkable: false,
  opaque: true,
  occludesPlayer: true,
  transparent: false,
} as const;

const props: Record<keyof typeof M, MaterialProps> = {
  air: {
    solid: false,
    walkable: false,
    opaque: false,
    occludesPlayer: false,
    transparent: true,
    color: 0x000000,
    tileIndex: 0,
  },
  grass: { ...solidGround, color: 0x5a9e3a, tileIndex: 1 },
  dirt: { ...solidGround, color: 0x8a5a33, tileIndex: 2 },
  stone: { ...solidGround, color: 0x7d7d84, tileIndex: 3 },
  sand: { ...solidGround, color: 0xd8c27a, tileIndex: 4 },
  water: {
    solid: true,
    walkable: false,
    opaque: false,
    occludesPlayer: false,
    transparent: true,
    color: 0x3a78c8,
    tileIndex: 5,
  },
  planks: { ...solidGround, color: 0xb0814a, tileIndex: 6 },
  log: { ...wall, occludesPlayer: false, color: 0x6b4423, tileIndex: 7 },
  leaves: {
    solid: false,
    walkable: false,
    opaque: false,
    occludesPlayer: true,
    transparent: true,
    color: 0x2f7a2a,
    tileIndex: 8,
  },
  stoneWall: { ...wall, color: 0x9a9aa2, tileIndex: 9 },
  brickWall: { ...wall, color: 0xb5603f, tileIndex: 10 },
  roof: { ...wall, color: 0x8c2f2f, tileIndex: 11 },
  glass: {
    ...wall,
    opaque: false,
    transparent: true,
    color: 0xbfe3f0,
    tileIndex: 12,
  },
  stairs: { ...solidGround, color: 0xa0703c, tileIndex: 13 },
  stoneFloor: { ...solidGround, color: 0xa8a8ae, tileIndex: 14 },
};

/** Default material table, indexed by material ID. */
export const MATERIALS: readonly Material[] = Object.entries(M)
  .map(([key, id]) => ({ id, key, ...props[key as keyof typeof M] }))
  .sort((a, b) => a.id - b.id);

export function getMaterial(id: MaterialId): Material {
  const material = MATERIALS[id];
  if (material == null) {
    throw new RangeError(`Unknown material id ${id}`);
  }
  return material;
}

export function isMaterialId(id: number): id is MaterialId {
  return Number.isInteger(id) && id >= 0 && id < MATERIALS.length;
}
