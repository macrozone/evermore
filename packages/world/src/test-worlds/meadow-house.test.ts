import { describe, expect, it } from "vitest";

import { M } from "../materials";
import { measureWorld, serializeWorld } from "../serialization";
import type { World } from "../world";
import { MAX_STEP_HEIGHT } from "../world";
import { MEADOW_HOUSE_LIGHTS, createMeadowHouseWorld } from "./meadow-house";

/** Standing positions reachable on foot from the spawn (4-neighbourhood). */
function reachable(world: World): Set<string> {
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  const { x, y, z } = world.spawn;
  const seen = new Set([key(x, y, z)]);
  const queue: [number, number, number][] = [[x, y, z]];
  for (let next = queue.pop(); next != null; next = queue.pop()) {
    const [cx, cy, cz] = next;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      for (let dz = -MAX_STEP_HEIGHT; dz <= MAX_STEP_HEIGHT; dz++) {
        const [nx, ny, nz] = [cx + dx, cy + dy, cz + dz];
        const k = key(nx, ny, nz);
        if (!seen.has(k) && world.isWalkable(nx, ny, nz)) {
          seen.add(k);
          queue.push([nx, ny, nz]);
        }
      }
    }
  }
  return seen;
}

describe("meadow-house test world", () => {
  const world = createMeadowHouseWorld();
  const walk = reachable(world);
  const canReach = (x: number, y: number, z: number) => walk.has(`${x},${y},${z}`);

  it("spawns the player on walkable ground in front of the house", () => {
    const { x, y, z } = world.spawn;
    expect(world.isWalkable(x, y, z)).toBe(true);
    expect(world.heightAt(x, y)).toBe(z);
  });

  it("is deterministic", () => {
    expect(serializeWorld(createMeadowHouseWorld())).toEqual(serializeWorld(world));
  });

  it("has a river that blocks movement and a bridge across it", () => {
    expect(world.getCell(44, 10, 2)).toBe(M.water);
    expect(world.isWalkable(44, 10, 3)).toBe(false);
    // on the bridge deck, above the water
    expect(world.getCell(42, 47, 2)).toBe(M.water);
    expect(canReach(42, 47, 4)).toBe(true);
    // far bank
    expect(canReach(50, 47, 3)).toBe(true);
  });

  it("makes the far bank unreachable without the bridge", () => {
    const noBridge = createMeadowHouseWorld();
    const deck = noBridge.getStructure("bridge");
    expect(deck).toBeDefined();
    if (deck == null) {
      return;
    }
    for (let y = deck.bounds.min.y; y < deck.bounds.max.y; y++) {
      for (let x = deck.bounds.min.x; x < deck.bounds.max.x; x++) {
        for (let z = deck.bounds.min.z; z < deck.bounds.max.z; z++) {
          noBridge.setCell(x, y, z, M.air);
        }
      }
    }
    expect(reachable(noBridge).has("50,47,3")).toBe(false);
  });

  it("has a hill with two levels reachable only by stairs", () => {
    expect(world.heightAt(60, 20)).toBe(5);
    expect(world.heightAt(70, 30)).toBe(7);
    expect(canReach(60, 20, 5)).toBe(true);
    expect(canReach(70, 30, 7)).toBe(true);
    // cliff edges are two cells high
    expect(world.heightAt(55, 20)).toBe(3);
    expect(world.heightAt(63, 20)).toBe(5);

    const noStairs = createMeadowHouseWorld();
    for (const [x, z] of [
      [55, 3],
      [63, 5],
    ] as const) {
      noStairs.setCell(x, 28, z, M.air);
      noStairs.setCell(x, 29, z, M.air);
    }
    expect(world.getCell(55, 28, 3)).toBe(M.stairs);
    const walkNoStairs = reachable(noStairs);
    expect(walkNoStairs.has("60,20,5")).toBe(false);
    expect(walkNoStairs.has("70,30,7")).toBe(false);
  });

  it("has a two-storey house with rooms and stairs", () => {
    // ground floor and upper floor are walkable and reachable
    expect(canReach(12, 36, 3)).toBe(true); // living room
    expect(canReach(22, 40, 3)).toBe(true); // kitchen
    expect(canReach(12, 36, 6)).toBe(true); // bedroom
    expect(canReach(22, 40, 6)).toBe(true); // study
    // walls and roof above
    expect(world.isSolid(8, 36, 3)).toBe(true);
    expect(world.heightAt(12, 36)).toBeGreaterThan(8);
    expect(world.heightAt(12, 36, 4)).toBe(3);
    expect(world.heightAt(12, 36, 7)).toBe(6);

    expect(world.structuresAt(12, 36, 3).map((s) => s.id)).toEqual([
      "house.living-room",
      "house",
    ]);
    expect(world.structuresAt(22, 40, 6)[0]?.id).toBe("house.study");
    expect(world.structuresAt(12, 50, 3)).toEqual([]);
  });

  it("has a tower with a spiral staircase to the roof platform", () => {
    expect(canReach(74, 24, 7)).toBe(true); // entry
    expect(canReach(74, 22, 19)).toBe(true); // platform above the pillar
    expect(world.structuresAt(73, 22, 10).map((s) => s.id)).toEqual(["tower.stairwell", "tower"]);
  });

  it("has trees with trunks that block and leaves that occlude", () => {
    let trunks = 0;
    let leaves = 0;
    for (let y = 0; y < world.depth; y++) {
      for (let x = 0; x < world.width; x++) {
        for (let z = 0; z < world.height; z++) {
          const cell = world.getCell(x, y, z);
          if (cell === M.log && z > 3) {
            trunks++;
          }
          if (cell === M.leaves) {
            leaves++;
          }
        }
      }
    }
    expect(trunks).toBeGreaterThan(10);
    expect(leaves).toBeGreaterThan(100);
  });

  it("adds home details without blocking room access or the garden gate", () => {
    expect(world.getCell(10, 32, 6)).toBe(M.bed);
    expect(world.getCell(13, 38, 3)).toBe(M.table);
    expect(world.getCell(10, 31, 3)).toBe(M.hearth);
    expect(world.getCell(6, 40, 3)).toBe(M.fence);
    expect(world.getCell(9, 46, 2)).toBe(M.flowers);
    expect(canReach(12, 52, 3)).toBe(true);
    expect(canReach(10, 35, 6)).toBe(true);
    expect(MEADOW_HOUSE_LIGHTS.every((light) => light.radius > 0)).toBe(true);
  });

  it("provides three light types with an outdoor fire and an exposed window", () => {
    expect(new Set(MEADOW_HOUSE_LIGHTS.map((light) => light.kind))).toEqual(new Set(["fire", "lantern", "window"]));
    expect(world.getCell(20, 49, 3)).toBe(M.hearth);
    expect(world.getCell(20, 43, 4)).toBe(M.glass);
    expect(world.getCell(20, 44, 4)).toBe(M.air);
    expect(canReach(20, 47, 3)).toBe(true);
  });

  it("reports its serialized size", () => {
    const report = measureWorld(world);
    console.log(
      [
        `meadow-house ${world.width}×${world.depth}×${world.height}: ${report.cells} cells, ${report.chunks} chunks`,
        `  raw (Uint16 grid): ${report.rawBytes} B`,
        `  run-length encoded: ${report.encodedBytes} B`,
        `  RLE + deflate: ${report.compressedBytes} B`,
      ].join("\n"),
    );
    expect(report.compressedBytes).toBeLessThan(report.encodedBytes);
    expect(report.encodedBytes).toBeLessThan(report.rawBytes);
  });
});
