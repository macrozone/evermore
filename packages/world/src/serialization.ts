import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate";

import type { Box, Vec3 } from "./geometry";
import { isMaterialId } from "./materials";
import type { Chunk, Structure, StructureKind } from "./world";
import {
  CHUNK_CELLS,
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  World,
} from "./world";

/*
 * Binary world format, version 1. All integers are unsigned LEB128 varints,
 * strings are a varint byte length followed by UTF-8.
 *
 *   "EVW" 0x01                      magic + version
 *   width depth height              world size in cells
 *   chunkX chunkY chunkZ            chunk size (must match this package)
 *   seed  name                      seed (uint32), name (string)
 *   spawnX spawnY spawnZ
 *   structures                      JSON array of Structure (string)
 *   chunkCount
 *   chunkCount × {
 *     cx cy cz runCount
 *     runCount × { length material } run-length encoded cells, chunk order
 *   }
 *
 * Chunks that contain only air are omitted. serializeWorld() additionally
 * deflates the whole buffer.
 */

const MAGIC = [0x45, 0x56, 0x57]; // "EVW"
const FORMAT_VERSION = 1;

class ByteWriter {
  private buffer = new Uint8Array(1024);
  private length = 0;

  byte(value: number): void {
    if (this.length === this.buffer.length) {
      const grown = new Uint8Array(this.buffer.length * 2);
      grown.set(this.buffer);
      this.buffer = grown;
    }
    this.buffer[this.length++] = value;
  }

  varint(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
      throw new RangeError(`Cannot encode ${value} as uint32 varint`);
    }
    let rest = value;
    while (rest >= 0x80) {
      this.byte((rest & 0x7f) | 0x80);
      rest = Math.floor(rest / 0x80);
    }
    this.byte(rest);
  }

  string(value: string): void {
    const bytes = strToU8(value);
    this.varint(bytes.length);
    for (const b of bytes) {
      this.byte(b);
    }
  }

  toBytes(): Uint8Array {
    return this.buffer.slice(0, this.length);
  }
}

class ByteReader {
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  byte(): number {
    const value = this.bytes[this.offset];
    if (value == null) {
      throw new RangeError("Unexpected end of world data");
    }
    this.offset++;
    return value;
  }

  varint(): number {
    let value = 0;
    let factor = 1;
    for (let i = 0; i < 5; i++) {
      const b = this.byte();
      value += (b & 0x7f) * factor;
      if ((b & 0x80) === 0) {
        return value;
      }
      factor *= 0x80;
    }
    throw new RangeError("Varint too long");
  }

  string(): string {
    const length = this.varint();
    if (this.offset + length > this.bytes.length) {
      throw new RangeError("Unexpected end of world data");
    }
    const value = strFromU8(this.bytes.subarray(this.offset, this.offset + length));
    this.offset += length;
    return value;
  }

  get done(): boolean {
    return this.offset === this.bytes.length;
  }
}

function isEmptyChunk(chunk: Chunk): boolean {
  return chunk.cells.every((cell) => cell === 0);
}

/** Run-length encodes the world into the uncompressed binary format. */
export function encodeWorld(world: World): Uint8Array {
  const w = new ByteWriter();
  for (const b of MAGIC) {
    w.byte(b);
  }
  w.byte(FORMAT_VERSION);
  w.varint(world.width);
  w.varint(world.depth);
  w.varint(world.height);
  w.varint(CHUNK_SIZE_X);
  w.varint(CHUNK_SIZE_Y);
  w.varint(CHUNK_SIZE_Z);
  w.varint(world.seed);
  w.string(world.name);
  w.varint(world.spawn.x);
  w.varint(world.spawn.y);
  w.varint(world.spawn.z);
  w.string(JSON.stringify(world.structures));

  const chunks = [...world.chunks()].filter((chunk) => !isEmptyChunk(chunk));
  w.varint(chunks.length);
  for (const chunk of chunks) {
    w.varint(chunk.cx);
    w.varint(chunk.cy);
    w.varint(chunk.cz);
    const runs: number[] = [];
    let runMaterial = chunk.cells[0] as number;
    let runLength = 0;
    for (const cell of chunk.cells) {
      if (cell === runMaterial) {
        runLength++;
      } else {
        runs.push(runLength, runMaterial);
        runMaterial = cell;
        runLength = 1;
      }
    }
    runs.push(runLength, runMaterial);
    w.varint(runs.length / 2);
    for (const value of runs) {
      w.varint(value);
    }
  }
  return w.toBytes();
}

/** Inverse of encodeWorld(). Throws on malformed or incompatible data. */
export function decodeWorld(bytes: Uint8Array): World {
  const r = new ByteReader(bytes);
  for (const b of MAGIC) {
    if (r.byte() !== b) {
      throw new Error("Not an Evermore world (bad magic)");
    }
  }
  const version = r.byte();
  if (version !== FORMAT_VERSION) {
    throw new Error(`Unsupported world format version ${version}`);
  }
  const width = r.varint();
  const depth = r.varint();
  const height = r.varint();
  const chunkSize = [r.varint(), r.varint(), r.varint()];
  if (
    chunkSize[0] !== CHUNK_SIZE_X ||
    chunkSize[1] !== CHUNK_SIZE_Y ||
    chunkSize[2] !== CHUNK_SIZE_Z
  ) {
    throw new Error(`Unsupported chunk size ${chunkSize.join("×")}`);
  }
  const seed = r.varint();
  const name = r.string();
  const spawn: Vec3 = { x: r.varint(), y: r.varint(), z: r.varint() };
  const structures = parseStructures(r.string());

  const world = new World({ width, depth, height, seed, name, spawn });
  for (const structure of structures) {
    world.addStructure(structure);
  }

  const chunkCount = r.varint();
  for (let i = 0; i < chunkCount; i++) {
    const cx = r.varint();
    const cy = r.varint();
    const cz = r.varint();
    const runCount = r.varint();
    const cells = new Uint16Array(CHUNK_CELLS);
    let offset = 0;
    for (let run = 0; run < runCount; run++) {
      const length = r.varint();
      const material = r.varint();
      if (!isMaterialId(material)) {
        throw new Error(`Unknown material id ${material}`);
      }
      if (offset + length > CHUNK_CELLS) {
        throw new Error(`Chunk (${cx}, ${cy}, ${cz}) has too many cells`);
      }
      cells.fill(material, offset, offset + length);
      offset += length;
    }
    if (offset !== CHUNK_CELLS) {
      throw new Error(`Chunk (${cx}, ${cy}, ${cz}) has too few cells`);
    }
    world.putChunk({ cx, cy, cz, cells });
  }
  if (!r.done) {
    throw new Error("Trailing bytes after world data");
  }
  return world;
}

/** Encoded and deflated world, ready to store or send. */
export function serializeWorld(world: World): Uint8Array {
  return deflateSync(encodeWorld(world), { level: 9 });
}

export function deserializeWorld(bytes: Uint8Array): World {
  return decodeWorld(inflateSync(bytes));
}

export interface WorldSizeReport {
  /** Cells inside the world bounds. */
  cells: number;
  /** Allocated, non-empty chunks. */
  chunks: number;
  /** Bytes as a dense Uint16 grid of the whole world. */
  rawBytes: number;
  /** Bytes after run-length encoding (encodeWorld). */
  encodedBytes: number;
  /** Bytes after run-length encoding and deflate (serializeWorld). */
  compressedBytes: number;
}

export function measureWorld(world: World): WorldSizeReport {
  const encoded = encodeWorld(world);
  const cells = world.width * world.depth * world.height;
  return {
    cells,
    chunks: [...world.chunks()].filter((chunk) => !isEmptyChunk(chunk)).length,
    rawBytes: cells * Uint16Array.BYTES_PER_ELEMENT,
    encodedBytes: encoded.length,
    compressedBytes: deflateSync(encoded, { level: 9 }).length,
  };
}

const STRUCTURE_KINDS: readonly StructureKind[] = ["building", "room", "bridge"];

function isVec3(value: unknown): value is Vec3 {
  if (typeof value !== "object" || value == null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return [v.x, v.y, v.z].every((n) => Number.isInteger(n));
}

function isBox(value: unknown): value is Box {
  if (typeof value !== "object" || value == null) {
    return false;
  }
  const b = value as Record<string, unknown>;
  return isVec3(b.min) && isVec3(b.max);
}

function parseStructures(json: string): Structure[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error("Structures must be an array");
  }
  return parsed.map((value: unknown, index) => {
    const s = (typeof value === "object" && value != null ? value : {}) as Record<
      string,
      unknown
    >;
    if (
      typeof s.id !== "string" ||
      typeof s.name !== "string" ||
      !STRUCTURE_KINDS.includes(s.kind as StructureKind) ||
      !isBox(s.bounds) ||
      (s.parentId != null && typeof s.parentId !== "string")
    ) {
      throw new Error(`Invalid structure at index ${index}`);
    }
    const structure: Structure = {
      id: s.id,
      kind: s.kind as StructureKind,
      name: s.name,
      bounds: s.bounds,
    };
    if (typeof s.parentId === "string") {
      structure.parentId = s.parentId;
    }
    return structure;
  });
}
