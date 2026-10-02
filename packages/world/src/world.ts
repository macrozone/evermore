import type { Box, Vec3 } from "./geometry";
import { boxContains, boxVolume } from "./geometry";
import type { Material, MaterialId } from "./materials";
import { AIR, getMaterial, isMaterialId } from "./materials";

export const CHUNK_SIZE_X = 32;
export const CHUNK_SIZE_Y = 32;
export const CHUNK_SIZE_Z = 16;
export const CHUNK_CELLS = CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z;

/** Height of the player in cells: standing needs this much free space. */
export const PLAYER_HEIGHT = 2;
/** Highest step (in cells) a player climbs without stairs. */
export const MAX_STEP_HEIGHT = 1;

/**
 * 32×32×16 block of cells. `cells` is indexed by
 * `x + y * CHUNK_SIZE_X + z * CHUNK_SIZE_X * CHUNK_SIZE_Y` (local coordinates),
 * so each horizontal layer is contiguous.
 */
export interface Chunk {
  /** Chunk coordinates (cell coordinate / chunk size). */
  cx: number;
  cy: number;
  cz: number;
  cells: Uint16Array;
}

export function chunkCellIndex(lx: number, ly: number, lz: number): number {
  return lx + ly * CHUNK_SIZE_X + lz * CHUNK_SIZE_X * CHUNK_SIZE_Y;
}

export type StructureKind = "building" | "room" | "bridge";

/**
 * Named region of the world, e.g. a building or a room in it. Renderers use it
 * to detect whether the player is inside (cutaway, roof fading).
 */
export interface Structure {
  id: string;
  kind: StructureKind;
  name: string;
  bounds: Box;
  /** Enclosing structure, e.g. the building of a room. */
  parentId?: string;
}

export interface WorldOptions {
  /** Size in cells along x (east). */
  width: number;
  /** Size in cells along y (south). */
  depth: number;
  /** Size in cells along z (up). */
  height: number;
  seed?: number;
  name?: string;
  /** Feet position where the player starts. */
  spawn?: Vec3;
}

/**
 * Bounded 3D cell grid, stored in lazily allocated chunks. Cells outside the
 * world read as air. Every cell holds one material ID.
 */
export class World {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly seed: number;
  name: string;
  spawn: Vec3;

  readonly chunksX: number;
  readonly chunksY: number;
  readonly chunksZ: number;

  private readonly chunkSlots: (Chunk | undefined)[];
  private readonly structureMap = new Map<string, Structure>();

  constructor(options: WorldOptions) {
    const { width, depth, height } = options;
    for (const [label, value] of Object.entries({ width, depth, height })) {
      if (!Number.isInteger(value) || value <= 0) {
        throw new RangeError(`World ${label} must be a positive integer, got ${value}`);
      }
    }
    this.width = width;
    this.depth = depth;
    this.height = height;
    this.seed = (options.seed ?? 0) >>> 0;
    this.name = options.name ?? "";
    this.spawn = options.spawn ?? { x: 0, y: 0, z: 0 };
    this.chunksX = Math.ceil(width / CHUNK_SIZE_X);
    this.chunksY = Math.ceil(depth / CHUNK_SIZE_Y);
    this.chunksZ = Math.ceil(height / CHUNK_SIZE_Z);
    this.chunkSlots = new Array<Chunk | undefined>(
      this.chunksX * this.chunksY * this.chunksZ,
    );
  }

  inBounds(x: number, y: number, z: number): boolean {
    return (
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      Number.isInteger(z) &&
      x >= 0 &&
      y >= 0 &&
      z >= 0 &&
      x < this.width &&
      y < this.depth &&
      z < this.height
    );
  }

  /** Material ID at a cell; air outside the world. */
  getCell(x: number, y: number, z: number): MaterialId {
    if (!this.inBounds(x, y, z)) {
      return AIR;
    }
    const chunk = this.chunkSlots[this.slotIndex(x, y, z)];
    if (chunk == null) {
      return AIR;
    }
    return chunk.cells[
      chunkCellIndex(x % CHUNK_SIZE_X, y % CHUNK_SIZE_Y, z % CHUNK_SIZE_Z)
    ] as MaterialId;
  }

  setCell(x: number, y: number, z: number, material: MaterialId): void {
    if (!this.inBounds(x, y, z)) {
      throw new RangeError(`Cell (${x}, ${y}, ${z}) is outside the world`);
    }
    if (!isMaterialId(material)) {
      throw new RangeError(`Unknown material id ${material}`);
    }
    const slot = this.slotIndex(x, y, z);
    let chunk = this.chunkSlots[slot];
    if (chunk == null) {
      if (material === AIR) {
        return;
      }
      chunk = {
        cx: Math.floor(x / CHUNK_SIZE_X),
        cy: Math.floor(y / CHUNK_SIZE_Y),
        cz: Math.floor(z / CHUNK_SIZE_Z),
        cells: new Uint16Array(CHUNK_CELLS),
      };
      this.chunkSlots[slot] = chunk;
    }
    chunk.cells[
      chunkCellIndex(x % CHUNK_SIZE_X, y % CHUNK_SIZE_Y, z % CHUNK_SIZE_Z)
    ] = material;
  }

  /** Sets every cell of the box (clipped to the world) to the material. */
  fill(bounds: Box, material: MaterialId): void {
    const minX = Math.max(0, bounds.min.x);
    const minY = Math.max(0, bounds.min.y);
    const minZ = Math.max(0, bounds.min.z);
    const maxX = Math.min(this.width, bounds.max.x);
    const maxY = Math.min(this.depth, bounds.max.y);
    const maxZ = Math.min(this.height, bounds.max.z);
    for (let z = minZ; z < maxZ; z++) {
      for (let y = minY; y < maxY; y++) {
        for (let x = minX; x < maxX; x++) {
          this.setCell(x, y, z, material);
        }
      }
    }
  }

  getMaterial(x: number, y: number, z: number): Material {
    return getMaterial(this.getCell(x, y, z));
  }

  isSolid(x: number, y: number, z: number): boolean {
    return this.getMaterial(x, y, z).solid;
  }

  /**
   * Whether a player can stand with their feet in cell (x, y, z): the cell
   * below is solid and walkable, and there is PLAYER_HEIGHT free (non-solid)
   * space inside the world.
   */
  isWalkable(x: number, y: number, z: number): boolean {
    if (!this.inBounds(x, y, z) || z === 0) {
      return false;
    }
    const ground = this.getMaterial(x, y, z - 1);
    if (!ground.solid || !ground.walkable) {
      return false;
    }
    for (let dz = 0; dz < PLAYER_HEIGHT; dz++) {
      if (z + dz >= this.height) {
        return false;
      }
      if (this.isSolid(x, y, z + dz)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Surface height of a column: one above the highest solid cell whose top is
   * at or below `maxZ` (default: the whole column). Returns 0 if there is no
   * solid cell. Inside multi-storey buildings pass `feetZ + MAX_STEP_HEIGHT`
   * to find the floor under the player instead of the roof.
   */
  heightAt(x: number, y: number, maxZ: number = this.height): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.depth) {
      return 0;
    }
    for (let z = Math.min(maxZ, this.height) - 1; z >= 0; z--) {
      if (this.isSolid(x, y, z)) {
        return z + 1;
      }
    }
    return 0;
  }

  getChunk(cx: number, cy: number, cz: number): Chunk | undefined {
    if (
      cx < 0 ||
      cy < 0 ||
      cz < 0 ||
      cx >= this.chunksX ||
      cy >= this.chunksY ||
      cz >= this.chunksZ
    ) {
      return undefined;
    }
    return this.chunkSlots[cx + cy * this.chunksX + cz * this.chunksX * this.chunksY];
  }

  /** Allocated chunks in z, y, x order. Unallocated chunks are all air. */
  *chunks(): IterableIterator<Chunk> {
    for (const chunk of this.chunkSlots) {
      if (chunk != null) {
        yield chunk;
      }
    }
  }

  /** Stores a decoded chunk, used by deserialization. */
  putChunk(chunk: Chunk): void {
    const { cx, cy, cz } = chunk;
    if (
      cx < 0 ||
      cy < 0 ||
      cz < 0 ||
      cx >= this.chunksX ||
      cy >= this.chunksY ||
      cz >= this.chunksZ
    ) {
      throw new RangeError(`Chunk (${cx}, ${cy}, ${cz}) is outside the world`);
    }
    if (chunk.cells.length !== CHUNK_CELLS) {
      throw new RangeError(`Chunk must have ${CHUNK_CELLS} cells`);
    }
    this.chunkSlots[cx + cy * this.chunksX + cz * this.chunksX * this.chunksY] = chunk;
  }

  addStructure(structure: Structure): void {
    if (this.structureMap.has(structure.id)) {
      throw new Error(`Duplicate structure id "${structure.id}"`);
    }
    if (structure.parentId != null && !this.structureMap.has(structure.parentId)) {
      throw new Error(
        `Structure "${structure.id}" references unknown parent "${structure.parentId}"`,
      );
    }
    this.structureMap.set(structure.id, structure);
  }

  getStructure(id: string): Structure | undefined {
    return this.structureMap.get(id);
  }

  get structures(): readonly Structure[] {
    return [...this.structureMap.values()];
  }

  /** Structures containing the cell, innermost (smallest) first. */
  structuresAt(x: number, y: number, z: number): Structure[] {
    return this.structures
      .filter((s) => boxContains(s.bounds, x, y, z))
      .sort((a, b) => boxVolume(a.bounds) - boxVolume(b.bounds));
  }

  private slotIndex(x: number, y: number, z: number): number {
    const cx = Math.floor(x / CHUNK_SIZE_X);
    const cy = Math.floor(y / CHUNK_SIZE_Y);
    const cz = Math.floor(z / CHUNK_SIZE_Z);
    return cx + cy * this.chunksX + cz * this.chunksX * this.chunksY;
  }
}
