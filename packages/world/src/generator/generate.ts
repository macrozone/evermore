import { box } from "../geometry";
import { M } from "../materials";
import { createRng, hashSeed } from "../rng";
import { World } from "../world";
import { parseWorldSpecification, type WorldSpecification } from "./specification";

/** Smooth seeded value noise, independent of traversal order. */
function noise(x: number, y: number, scale: number, seed: number): number {
  const gx = Math.floor(x / scale), gy = Math.floor(y / scale);
  const smooth = (v: number) => v * v * (3 - 2 * v);
  const tx = smooth(x / scale - gx), ty = smooth(y / scale - gy);
  const sample = (a: number, b: number) => hashSeed(`${seed}:${a}:${b}`) / 0xffffffff;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return lerp(lerp(sample(gx, gy), sample(gx + 1, gy), tx), lerp(sample(gx, gy + 1), sample(gx + 1, gy + 1), tx), ty);
}

/** G1: pure world generation. Timings belong to the caller, not world data. */
export function generateWorld(input: WorldSpecification, seed: number | string): World {
  const spec = parseWorldSpecification(input);
  const { width, depth, height } = spec.size;
  const world = new World({ width, depth, height, seed: hashSeed(seed), name: spec.name });
  const rng = createRng(seed);
  const ground = spec.biome === "desert" || spec.biome === "coast" ? M.sand : spec.biome === "mountain" ? M.stone : M.grass;
  const base = Math.max(spec.terrain.elevation, spec.water.level + 1);
  const reserved = new Set<number>();
  const key = (x: number, y: number) => x + y * width;
  const column = (x: number, y: number, top: number, material: number) => {
    world.fill(box(x, y, 0, x + 1, y + 1, height), M.air);
    world.fill(box(x, y, 0, x + 1, y + 1, top), M.dirt);
    world.setCell(x, y, top - 1, material);
  };
  for (let y = 0; y < depth; y++) for (let x = 0; x < width; x++) {
    const wet = spec.water.kind === "sea" ? x < Math.floor(width / 6) : spec.water.kind === "river" && Math.abs(x - (Math.floor(width / 6) + Math.round(Math.sin(y / 9) * 2))) <= 1;
    const top = wet ? spec.water.level : base + Math.round(noise(x, y, spec.terrain.scale, world.seed) * spec.terrain.relief);
    column(x, y, top, wet ? M.water : ground);
  }
  const pave = (x: number, y: number) => {
    if (x < 1 || y < 1 || x >= width - 1 || y >= depth - 1) return;
    const water = world.getCell(x, y, world.heightAt(x, y) - 1) === M.water;
    column(x, y, base, water ? M.planks : M.stoneFloor);
    reserved.add(key(x, y));
  };
  const route = (x: number, y: number) => {
    let px = spec.spawn.x, py = spec.spawn.y;
    const stamp = () => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) pave(px + dx, py + dy); };
    stamp();
    while (px !== x) { px += Math.sign(x - px); stamp(); }
    while (py !== y) { py += Math.sign(y - py); stamp(); }
  };
  // All routes are laid before buildings; foundations reserve a clear apron.
  if (spec.paths) {
    for (const b of spec.settlement.buildings) route(b.x + b.width - 3, b.y + b.depth + 1);
    for (const l of spec.landmarks) route(l.x, l.y + 2);
  }
  pave(spec.spawn.x, spec.spawn.y);
  for (const b of spec.settlement.buildings) {
    for (let y = b.y - 1; y <= b.y + b.depth; y++) for (let x = b.x - 1; x <= b.x + b.width; x++) {
      column(x, y, base, ground);
      reserved.add(key(x, y));
    }
    world.fill(box(b.x, b.y, base - 1, b.x + b.width, b.y + b.depth, base + b.floors * 4 + 1), M.air);
    for (let floor = 0; floor < b.floors; floor++) {
      const z = base - 1 + floor * 4;
      world.fill(box(b.x, b.y, z, b.x + b.width, b.y + b.depth, z + 1), M.planks);
      world.fill(box(b.x, b.y, z + 1, b.x + b.width, b.y + 1, z + 4), M.stoneWall);
      world.fill(box(b.x, b.y + b.depth - 1, z + 1, b.x + b.width, b.y + b.depth, z + 4), M.stoneWall);
      world.fill(box(b.x, b.y, z + 1, b.x + 1, b.y + b.depth, z + 4), M.stoneWall);
      world.fill(box(b.x + b.width - 1, b.y, z + 1, b.x + b.width, b.y + b.depth, z + 4), M.stoneWall);
    }
    const roofZ = base - 1 + b.floors * 4;
    world.fill(box(b.x, b.y, roofZ, b.x + b.width, b.y + b.depth, roofZ + 1), M.roof);
    // A two-cell entrance and alternating stair flights preserve headroom.
    const doorX = b.x + b.width - 3;
    world.fill(box(doorX, b.y + b.depth - 1, base, doorX + 1, b.y + b.depth, base + 2), M.air);
    for (let floor = 0; floor < b.floors - 1; floor++) {
      const z = base - 1 + floor * 4;
      const sy = floor % 2 === 0 ? b.y + 2 : b.y + b.depth - 3;
      world.fill(box(b.x + 2, sy, z + 4, b.x + 6, sy + 1, z + 6), M.air);
      for (let step = 1; step <= 4; step++) {
        world.fill(box(b.x + 1 + step, sy, z + 1, b.x + 2 + step, sy + 1, z + step + 1), M.stairs);
      }
    }
    const id = `building-${world.structures.length}`;
    world.addStructure({ id, kind: "building", name: b.name, bounds: box(b.x, b.y, base, b.x + b.width, b.y + b.depth, roofZ) });
    for (let floor = 0; floor < b.floors; floor++) world.addStructure({
      id: `${id}-floor-${floor}`, parentId: id, kind: "room", name: `${b.name} · floor ${floor + 1}`,
      bounds: box(b.x + 1, b.y + 1, base + floor * 4, b.x + b.width - 1, b.y + b.depth - 1, base + floor * 4 + 3),
    });
  }
  for (const l of spec.landmarks) {
    if (reserved.has(key(l.x, l.y)) && spec.settlement.buildings.some(b => l.x >= b.x - 1 && l.x <= b.x + b.width && l.y >= b.y - 1 && l.y <= b.y + b.depth)) continue;
    const z = world.heightAt(l.x, l.y);
    world.fill(box(l.x, l.y, z, l.x + 1, l.y + 1, z + 3), M.stoneWall);
    reserved.add(key(l.x, l.y));
  }
  for (let y = 2; y < depth - 2; y++) for (let x = 2; x < width - 2; x++) {
    if (reserved.has(key(x, y)) || !rng.chance(spec.vegetation.density)) continue;
    const z = world.heightAt(x, y);
    if (world.getCell(x, y, z - 1) === M.water) continue;
    world.fill(box(x, y, z, x + 1, y + 1, z + 3), M.log);
    world.fill(box(x - 1, y - 1, z + 3, x + 2, y + 2, z + 5), M.leaves);
  }
  world.spawn = { ...spec.spawn, z: base };
  return world;
}
