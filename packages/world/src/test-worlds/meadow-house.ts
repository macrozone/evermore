import type { Box } from "../geometry";
import { box, boxContains } from "../geometry";
import { M } from "../materials";
import { createRng } from "../rng";
import { World } from "../world";

export const MEADOW_HOUSE_SEED = 20261002;

/** Surface height of the meadow: stone (z 0), dirt (z 1), grass (z 2). */
const GROUND = 3;

const WIDTH = 96;
const DEPTH = 96;
const HEIGHT = 32;

/** River centre line, meandering slightly around x = 44. */
function riverCenter(y: number): number {
  return 44 + Math.round(2 * Math.sin(y / 9));
}

/** Rows of the bridge; the railings sit on the first and last row. */
const BRIDGE_Y = { min: 46, max: 50 };

/** Hill levels: each adds two cells, so the edges are cliffs needing stairs. */
const HILL_LEVEL_1 = box(56, 10, GROUND, 92, 50, GROUND + 2);
const HILL_LEVEL_2 = box(64, 14, GROUND + 2, 88, 42, GROUND + 4);
const HILL_STAIRS_Y = { min: 28, max: 30 };

const HOUSE = box(8, 30, GROUND, 26, 44, GROUND + 5);
const HOUSE_DOOR_X = 12;
const TOWER = box(72, 20, GROUND + 4, 78, 26, GROUND + 4 + 11);

/**
 * Hand-built test world: meadow with trees, a river with a bridge, a two-level
 * hill reachable by stairs with a tower on top, and a two-storey house with
 * rooms. Deterministic: tree placement uses a seeded RNG.
 */
export function createMeadowHouseWorld(): World {
  const world = new World({
    width: WIDTH,
    depth: DEPTH,
    height: HEIGHT,
    seed: MEADOW_HOUSE_SEED,
    name: "meadow-house",
    spawn: { x: HOUSE_DOOR_X, y: HOUSE.max.y + 1, z: GROUND },
  });

  buildTerrain(world);
  const bridge = buildRiver(world);
  buildHill(world);
  buildPaths(world, bridge);
  buildHouse(world);
  buildTower(world);
  furnishHome(world);
  plantGarden(world);
  plantTrees(world, [
    // keep clear: house + garden, paths, stair approaches, tower
    box(HOUSE.min.x - 3, HOUSE.min.y - 3, 0, HOUSE.max.x + 3, BRIDGE_Y.max + 1, HEIGHT),
    box(bridge.max.x - 1, HILL_STAIRS_Y.min - 2, 0, HILL_LEVEL_2.min.x + 3, BRIDGE_Y.max + 1, HEIGHT),
    box(TOWER.min.x - 3, TOWER.min.y - 3, 0, TOWER.max.x + 3, TOWER.max.y + 3, HEIGHT),
  ]);
  return world;
}

function buildTerrain(world: World): void {
  world.fill(box(0, 0, 0, WIDTH, DEPTH, 1), M.stone);
  world.fill(box(0, 0, 1, WIDTH, DEPTH, 2), M.dirt);
  world.fill(box(0, 0, 2, WIDTH, DEPTH, 3), M.grass);
}

/** Returns the bounds of the bridge deck. */
function buildRiver(world: World): Box {
  for (let y = 0; y < DEPTH; y++) {
    const center = riverCenter(y);
    world.fill(box(center - 4, y, 2, center + 4, y + 1, 3), M.sand);
    world.fill(box(center - 3, y, 0, center + 3, y + 1, 1), M.sand);
    world.fill(box(center - 3, y, 1, center + 3, y + 1, 3), M.water);
  }

  let minX = Infinity;
  let maxX = -Infinity;
  for (let y = BRIDGE_Y.min; y < BRIDGE_Y.max; y++) {
    minX = Math.min(minX, riverCenter(y) - 4);
    maxX = Math.max(maxX, riverCenter(y) + 4);
  }
  const deck = box(minX, BRIDGE_Y.min, GROUND, maxX, BRIDGE_Y.max, GROUND + 1);
  world.fill(deck, M.planks);
  world.fill(box(minX, BRIDGE_Y.min, GROUND + 1, maxX, BRIDGE_Y.min + 1, GROUND + 2), M.log);
  world.fill(box(minX, BRIDGE_Y.max - 1, GROUND + 1, maxX, BRIDGE_Y.max, GROUND + 2), M.log);
  world.addStructure({
    id: "bridge",
    kind: "bridge",
    name: "Bridge",
    bounds: box(minX, BRIDGE_Y.min, GROUND, maxX, BRIDGE_Y.max, GROUND + 3),
  });
  return deck;
}

function buildHill(world: World): void {
  for (const level of [HILL_LEVEL_1, HILL_LEVEL_2]) {
    world.fill(level, M.stone);
    world.fill(
      box(level.min.x, level.min.y, level.max.z - 1, level.max.x, level.max.y, level.max.z),
      M.grass,
    );
    // one step in front of the cliff: ground +1, then the level (+2) is +1 again
    world.fill(
      box(
        level.min.x - 1,
        HILL_STAIRS_Y.min,
        level.min.z,
        level.min.x,
        HILL_STAIRS_Y.max,
        level.min.z + 1,
      ),
      M.stairs,
    );
  }
}

/** Cobblestone path: house door → bridge → hill stairs. */
function buildPaths(world: World, bridge: Box): void {
  const pathY = { min: BRIDGE_Y.min + 1, max: BRIDGE_Y.max - 1 };
  const z = GROUND - 1;
  const paths = [
    box(HOUSE_DOOR_X - 1, HOUSE.max.y, z, HOUSE_DOOR_X + 2, pathY.max, z + 1),
    box(HOUSE_DOOR_X - 1, pathY.min, z, bridge.min.x, pathY.max, z + 1),
    box(bridge.max.x, pathY.min, z, 53, pathY.max, z + 1),
    box(51, HILL_STAIRS_Y.min, z, 53, pathY.max, z + 1),
    box(51, HILL_STAIRS_Y.min, z, HILL_LEVEL_1.min.x - 1, HILL_STAIRS_Y.max, z + 1),
  ];
  for (const path of paths) {
    world.fill(path, M.stoneFloor);
  }
}

/**
 * Two storeys, each with two rooms. Ground floor stands on z 3 (walls z 3–4),
 * the plank ceiling at z 5 is the upper floor (walls z 6–7), roof from z 8.
 */
function buildHouse(world: World): void {
  const { min, max } = HOUSE;
  const ground = min.z;
  const upper = ground + 3;
  const wallX = 17;
  const inner = box(min.x + 1, min.y + 1, ground, max.x - 1, max.y - 1, max.z);

  // outer walls, floors
  world.fill(box(min.x, min.y, ground, max.x, max.y, max.z), M.brickWall);
  world.fill(inner, M.air);
  world.fill(box(inner.min.x, inner.min.y, ground - 1, inner.max.x, inner.max.y, ground), M.planks);
  world.fill(box(inner.min.x, inner.min.y, upper - 1, inner.max.x, inner.max.y, upper), M.planks);

  // inner walls with doorways
  world.fill(box(wallX, inner.min.y, ground, wallX + 1, inner.max.y, upper - 1), M.brickWall);
  world.fill(box(wallX, 37, ground, wallX + 1, 38, ground + 2), M.air);
  world.fill(box(wallX, inner.min.y, upper, wallX + 1, inner.max.y, max.z), M.brickWall);
  world.fill(box(wallX, 40, upper, wallX + 1, 41, upper + 2), M.air);

  // front door
  world.fill(box(HOUSE_DOOR_X, max.y - 1, ground, HOUSE_DOOR_X + 1, max.y, ground + 2), M.air);

  // windows
  for (const z of [ground + 1, upper + 1]) {
    for (const x of [15, 20, 23]) {
      world.setCell(x, max.y - 1, z, M.glass);
    }
    for (const x of [11, 14, 21]) {
      world.setCell(x, min.y, z, M.glass);
    }
    world.setCell(min.x, 36, z, M.glass);
    world.setCell(max.x - 1, 38, z, M.glass);
  }

  // stairs in the east room along the north wall, two cells wide, with a
  // stairwell cut into the ceiling for headroom
  const stairY = { min: inner.min.y, max: inner.min.y + 2 };
  for (let step = 0; step < 3; step++) {
    const x = 20 + step;
    world.fill(box(x, stairY.min, ground, x + 1, stairY.max, ground + step + 1), M.stairs);
  }
  // Include the approach cell: the full player AABB rises before its center
  // crosses the first riser and needs two cells of clearance there too.
  world.fill(box(19, stairY.min, upper - 1, 22, stairY.max, upper), M.air);

  // gable roof, overhanging by one cell
  for (let layer = 0; ; layer++) {
    const minY = min.y - 1 + layer;
    const maxY = max.y + 1 - layer;
    if (minY >= maxY) {
      break;
    }
    world.fill(box(min.x - 1, minY, max.z + layer, max.x + 1, maxY, max.z + layer + 1), M.roof);
  }

  world.addStructure({
    id: "house",
    kind: "building",
    name: "House",
    bounds: box(min.x, min.y, ground, max.x, max.y, HEIGHT),
  });
  const rooms = [
    { id: "house.living-room", name: "Living room", minX: inner.min.x, maxX: wallX, z: ground },
    { id: "house.kitchen", name: "Kitchen", minX: wallX + 1, maxX: inner.max.x, z: ground },
    { id: "house.bedroom", name: "Bedroom", minX: inner.min.x, maxX: wallX, z: upper },
    { id: "house.study", name: "Study", minX: wallX + 1, maxX: inner.max.x, z: upper },
  ];
  for (const room of rooms) {
    world.addStructure({
      id: room.id,
      kind: "room",
      name: room.name,
      parentId: "house",
      bounds: box(room.minX, inner.min.y, room.z, room.maxX, inner.max.y, room.z + 2),
    });
  }
}

/**
 * Square stone tower on the upper hill level. A spiral staircase of eleven
 * steps winds around a central pillar to the roof platform (12 cells up).
 */
function buildTower(world: World): void {
  const { min, max } = TOWER;
  const base = min.z;
  const top = max.z; // slab z, standing height top + 1

  world.fill(box(min.x, min.y, base - 1, max.x, max.y, base), M.stoneFloor);
  world.fill(box(min.x, min.y, base, max.x, max.y, top), M.stoneWall);
  world.fill(box(min.x + 1, min.y + 1, base, max.x - 1, max.y - 1, top), M.air);
  world.fill(box(min.x + 2, min.y + 2, base, max.x - 2, max.y - 2, top), M.stoneWall);

  // door in the south wall, entry cell is the first ring cell
  const doorX = min.x + 2;
  world.fill(box(doorX, max.y - 1, base, doorX + 1, max.y, base + 2), M.air);

  // ring of interior cells, clockwise starting at the entry
  const ring: [number, number][] = [];
  const x0 = min.x + 1;
  const x1 = max.x - 2;
  const y0 = min.y + 1;
  const y1 = max.y - 2;
  for (let x = doorX; x > x0; x--) {
    ring.push([x, y1]);
  }
  for (let y = y1; y > y0; y--) {
    ring.push([x0, y]);
  }
  for (let x = x0; x < x1; x++) {
    ring.push([x, y0]);
  }
  for (let y = y0; y < y1; y++) {
    ring.push([x1, y]);
  }
  for (let x = x1; x > doorX; x--) {
    ring.push([x, y1]);
  }

  // steps 1..11 as solid columns, step 12 is part of the roof slab
  for (let step = 1; step < ring.length; step++) {
    const [x, y] = ring[step] as [number, number];
    world.fill(box(x, y, base, x + 1, y + 1, base + step), M.stairs);
  }
  world.fill(box(min.x, min.y, top, max.x, max.y, top + 1), M.stoneFloor);
  // headroom for the last two steps
  for (const step of [ring.length - 2, ring.length - 1]) {
    const [x, y] = ring[step] as [number, number];
    world.setCell(x, y, top, M.air);
  }

  // crenellations
  for (let x = min.x; x < max.x; x++) {
    for (let y = min.y; y < max.y; y++) {
      const onEdge = x === min.x || x === max.x - 1 || y === min.y || y === max.y - 1;
      if (onEdge && (x + y) % 2 === 0) {
        world.setCell(x, y, top + 1, M.stoneWall);
      }
    }
  }

  // windows
  world.setCell(min.x, min.y + 2, base + 4, M.glass);
  world.setCell(max.x - 1, min.y + 3, base + 7, M.glass);
  world.setCell(min.x + 3, min.y, base + 9, M.glass);

  world.addStructure({
    id: "tower",
    kind: "building",
    name: "Tower",
    bounds: box(min.x, min.y, base, max.x, max.y, top + 2),
  });
  world.addStructure({
    id: "tower.stairwell",
    kind: "room",
    name: "Stairwell",
    parentId: "tower",
    bounds: box(min.x + 1, min.y + 1, base, max.x - 1, max.y - 1, top),
  });
}

function plantTrees(world: World, keepClear: Box[]): void {
  const rng = createRng(world.seed).fork("trees");
  const trunks: [number, number][] = [];
  const attempts = 400;
  const wanted = 28;

  for (let i = 0; i < attempts && trunks.length < wanted; i++) {
    const x = rng.int(2, WIDTH - 3);
    const y = rng.int(2, DEPTH - 3);
    if (keepClear.some((area) => boxContains(area, x, y, 0))) {
      continue;
    }
    if (trunks.some(([tx, ty]) => Math.max(Math.abs(tx - x), Math.abs(ty - y)) < 5)) {
      continue;
    }
    const h = world.heightAt(x, y);
    let flatGrass = true;
    for (let dy = -2; dy <= 2 && flatGrass; dy++) {
      for (let dx = -2; dx <= 2 && flatGrass; dx++) {
        flatGrass =
          world.heightAt(x + dx, y + dy) === h && world.getCell(x + dx, y + dy, h - 1) === M.grass;
      }
    }
    if (!flatGrass) {
      continue;
    }
    trunks.push([x, y]);

    const trunkHeight = rng.int(3, 4);
    for (let z = h + trunkHeight - 1; z <= h + trunkHeight + 1; z++) {
      const radius = z === h + trunkHeight + 1 ? 1 : 2;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const corner = Math.abs(dx) === 2 && Math.abs(dy) === 2;
          if (!corner) {
            world.setCell(x + dx, y + dy, z, M.leaves);
          }
        }
      }
    }
    world.fill(box(x, y, h, x + 1, y + 1, h + trunkHeight), M.log);
  }
}


/** Light data is a fixture companion, independent of the binary world format. */
export const MEADOW_HOUSE_LIGHTS = [
  { id: "hearth", kind: "fire", x: 10, y: 32, z: 4, radius: 5, color: 0xffb65c },
  { id: "door-lantern", kind: "lantern", x: 10, y: 44, z: 5, radius: 6, color: 0xffcf83 },
  { id: "garden-lantern", kind: "lantern", x: 25, y: 46, z: 5, radius: 5, color: 0xffcf83 },
  { id: "window", kind: "window", x: 20, y: 43, z: 4.5, radius: 7, color: 0xffd894 },
  { id: "garden-fire", kind: "fire", x: 20, y: 49, z: 4.3, radius: 7, color: 0xffb65c },
] as const;

function furnishHome(world: World): void {
  // A firepit lets the light experiment show fire outside the closed roof.
  world.fill(box(19, 48, 3, 22, 51, 4), M.stone);
  world.setCell(20, 49, 3, M.hearth);
  world.fill(box(10, 31, 3, 12, 33, 4), M.hearth);
  world.fill(box(13, 38, 3, 15, 40, 4), M.table);
  world.fill(box(10, 32, 6, 12, 35, 7), M.bed);
  world.fill(box(20, 38, 6, 23, 40, 7), M.table);
  for (const [x, y] of [[10, 44], [25, 46]] as const) {
    world.setCell(x, y, 3, M.log);
    world.setCell(x, y, 4, M.lantern);
  }
}

function plantGarden(world: World): void {
  // Leave the door, cobblestone path and bridge approaches open.
  for (let x = 6; x < 29; x++) {
    world.setCell(x, 26, 3, M.fence);
    if (x < 11 || x > 14) world.setCell(x, 51, 3, M.fence);
  }
  for (let y = 27; y < 51; y++) {
    world.setCell(6, y, 3, M.fence);
    world.setCell(28, y, 3, M.fence);
  }
  for (const [x, y] of [[9, 46], [17, 45], [21, 46], [24, 48], [9, 28], [22, 28]] as const) {
    world.fill(box(x, y, 2, x + 2, y + 1, 3), M.flowers);
  }
  for (const [x, y] of [[31, 38], [34, 54], [18, 55], [8, 54]] as const) {
    world.setCell(x, y, 3, M.stone);
  }
}
