import { describe, expect, it } from "vitest";

import { box } from "./geometry";
import { M } from "./materials";
import {
  decodeWorld,
  deserializeWorld,
  encodeWorld,
  measureWorld,
  serializeWorld,
} from "./serialization";
import { CHUNK_CELLS, World } from "./world";

function sampleWorld(): World {
  const world = new World({
    width: 50,
    depth: 40,
    height: 20,
    seed: 1234,
    name: "sample – ünïcode",
    spawn: { x: 3, y: 4, z: 2 },
  });
  world.fill(box(0, 0, 0, 50, 40, 1), M.stone);
  world.fill(box(0, 0, 1, 50, 40, 2), M.grass);
  world.fill(box(10, 10, 2, 14, 14, 6), M.brickWall);
  world.setCell(49, 39, 19, M.glass);
  world.addStructure({ id: "hut", kind: "building", name: "Hut", bounds: box(10, 10, 2, 14, 14, 6) });
  world.addStructure({
    id: "hut.room",
    kind: "room",
    name: "Room",
    parentId: "hut",
    bounds: box(11, 11, 2, 13, 13, 5),
  });
  return world;
}

function expectSameWorld(actual: World, expected: World): void {
  expect(actual.width).toBe(expected.width);
  expect(actual.depth).toBe(expected.depth);
  expect(actual.height).toBe(expected.height);
  expect(actual.seed).toBe(expected.seed);
  expect(actual.name).toBe(expected.name);
  expect(actual.spawn).toEqual(expected.spawn);
  expect(actual.structures).toEqual(expected.structures);
  for (let z = 0; z < expected.height; z++) {
    for (let y = 0; y < expected.depth; y++) {
      for (let x = 0; x < expected.width; x++) {
        if (actual.getCell(x, y, z) !== expected.getCell(x, y, z)) {
          throw new Error(`Cell (${x}, ${y}, ${z}) differs`);
        }
      }
    }
  }
}

describe("world serialization", () => {
  it("round-trips through encode/decode", () => {
    const world = sampleWorld();
    expectSameWorld(decodeWorld(encodeWorld(world)), world);
  });

  it("round-trips through serialize/deserialize", () => {
    const world = sampleWorld();
    expectSameWorld(deserializeWorld(serializeWorld(world)), world);
  });

  it("is deterministic", () => {
    expect(serializeWorld(sampleWorld())).toEqual(serializeWorld(sampleWorld()));
  });

  it("omits chunks that contain only air", () => {
    const world = new World({ width: 64, depth: 64, height: 16 });
    world.setCell(1, 1, 1, M.stone);
    world.setCell(40, 40, 1, M.stone);
    world.setCell(40, 40, 1, M.air);
    expect(measureWorld(world).chunks).toBe(1);
    expect([...decodeWorld(encodeWorld(world)).chunks()]).toHaveLength(1);
  });

  it("rejects foreign or corrupt data", () => {
    const bytes = encodeWorld(sampleWorld());
    expect(() => decodeWorld(new Uint8Array([1, 2, 3, 4]))).toThrow(/magic/);

    const wrongVersion = bytes.slice();
    wrongVersion[3] = 99;
    expect(() => decodeWorld(wrongVersion)).toThrow(/version/);

    expect(() => decodeWorld(bytes.subarray(0, bytes.length - 1))).toThrow();
    expect(() => decodeWorld(new Uint8Array([...bytes, 0]))).toThrow(/Trailing/);
  });

  it("measures raw, encoded and compressed size", () => {
    const world = sampleWorld();
    const report = measureWorld(world);
    expect(report.cells).toBe(50 * 40 * 20);
    expect(report.rawBytes).toBe(report.cells * 2);
    expect(report.chunks).toBe(5); // 2×2 ground chunks + the glass cell up high
    expect(report.encodedBytes).toBe(encodeWorld(world).length);
    expect(report.compressedBytes).toBe(serializeWorld(world).length);
    expect(report.encodedBytes).toBeLessThan(report.chunks * CHUNK_CELLS * 2);
  });
});
