import { box } from "../geometry";
import { M } from "../materials";
import { World } from "../world";

export const RASTER_SIZE = 24;
export const RASTER_HEIGHT = 4;
export const RASTER_LEGEND = { ".": M.air, g: M.grass, p: M.stoneFloor, w: M.water, f: M.planks, "#": M.stoneWall, r: M.roof, b: M.bed, t: M.log } as const;
export interface RasterBuilding { name: string; x: number; y: number; width: number; depth: number; door: { x: number; y: number } }
export interface RasterMap { version: 1; name: string; layers: string[][]; spawn: { x: number; y: number }; buildings: RasterBuilding[] }
export interface RasterReport {
  changedCells: number; wallRepairs: number; doorRepairs: number; floorRepairs: number; routeRepairs: number;
  targets: number; unreachableBefore: number; reachableAfter: number;
}
const pointSchema = { type: "object", additionalProperties: false, required: ["x", "y"], properties: { x: { type: "integer", minimum: 0, maximum: 23 }, y: { type: "integer", minimum: 0, maximum: 23 } } };
export const RASTER_SCHEMA = {
  type: "object", additionalProperties: false, required: ["version", "name", "layers", "spawn", "buildings"],
  properties: {
    version: { type: "integer", const: 1 }, name: { type: "string", minLength: 1, maxLength: 120 }, spawn: pointSchema,
    layers: { type: "array", minItems: 4, maxItems: 4, items: { type: "array", minItems: 24, maxItems: 24, items: { type: "string", minLength: 24, maxLength: 24, pattern: "^[.gpwf#rbt]+$" } } },
    buildings: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, required: ["name", "x", "y", "width", "depth", "door"], properties: { name: { type: "string", minLength: 1, maxLength: 120 }, x: { type: "integer", minimum: 1, maximum: 18 }, y: { type: "integer", minimum: 1, maximum: 18 }, width: { type: "integer", minimum: 4, maximum: 12 }, depth: { type: "integer", minimum: 4, maximum: 12 }, door: pointSchema } } },
  },
} as const;

/** Strict bounded wire format. Geometry errors are rejected; cell inconsistencies can be repaired. */
export function parseRasterMap(value: unknown): RasterMap {
  const object = (v: unknown, keys: string[]): Record<string, unknown> => {
    if (v === null || typeof v !== "object" || Array.isArray(v) || Object.keys(v).length !== keys.length || keys.some(k => !(k in v))) throw new TypeError("Invalid raster object.");
    return v as Record<string, unknown>;
  };
  const integer = (v: unknown, min: number, max: number): number => {
    if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) throw new RangeError("Raster coordinate out of bounds.");
    return v;
  };
  const name = (v: unknown): string => {
    if (typeof v !== "string" || v.trim().length === 0 || v.length > 120) throw new TypeError("Invalid raster name.");
    return v;
  };
  const point = (v: unknown) => { const p = object(v, ["x", "y"]); return { x: integer(p.x, 0, 23), y: integer(p.y, 0, 23) }; };
  const map = object(value, ["version", "name", "layers", "spawn", "buildings"]);
  if (map.version !== 1 || !Array.isArray(map.layers) || map.layers.length !== 4) throw new TypeError("Expected four raster layers.");
  const layers = map.layers.map(layer => {
    if (!Array.isArray(layer) || layer.length !== 24 || layer.some(row => typeof row !== "string" || row.length !== 24 || !/^[.gpwf#rbt]+$/.test(row))) throw new TypeError("Expected 24 rows of 24 known characters.");
    return [...layer] as string[];
  });
  const spawn = point(map.spawn);
  if (!Array.isArray(map.buildings) || map.buildings.length > 4) throw new TypeError("Expected at most four buildings.");
  const buildings = map.buildings.map(value => {
    const b = object(value, ["name", "x", "y", "width", "depth", "door"]);
    const result = { name: name(b.name), x: integer(b.x, 1, 18), y: integer(b.y, 1, 18), width: integer(b.width, 4, 12), depth: integer(b.depth, 4, 12), door: point(b.door) };
    const right = result.x + result.width - 1, bottom = result.y + result.depth - 1;
    if (right > 22 || bottom > 22) throw new RangeError("Buildings need an exterior apron.");
    const { x, y } = result.door;
    if (!((x > result.x && x < right && (y === result.y || y === bottom)) || (y > result.y && y < bottom && (x === result.x || x === right)))) throw new RangeError("Door must be on a non-corner perimeter cell.");
    return result;
  });
  const inside = (x: number, y: number, b: RasterBuilding) => x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.depth;
  if (buildings.some(b => inside(spawn.x, spawn.y, b))) throw new RangeError("Spawn must be outside buildings.");
  for (let i = 0; i < buildings.length; i++) for (let j = i + 1; j < buildings.length; j++) {
    const a = buildings[i]!, b = buildings[j]!;
    if (a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.depth && a.y + a.depth >= b.y) throw new RangeError("Buildings need a clear cell between footprints.");
  }
  return { version: 1, name: name(map.name), layers, spawn, buildings };
}

/** Interpret the LLM's cells directly, then repair only explicit structural and navigation constraints. */
export function compileRasterMap(value: unknown, seed = 0): { world: World; raster: RasterMap; report: RasterReport } {
  const raster = parseRasterMap(value);
  const world = new World({ width: 24, depth: 24, height: 4, seed, name: raster.name, spawn: { ...raster.spawn, z: 1 } });
  for (let z = 0; z < 4; z++) for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) world.setCell(x, y, z, RASTER_LEGEND[raster.layers[z]![y]![x] as keyof typeof RASTER_LEGEND]);
  const report: RasterReport = { changedCells: 0, wallRepairs: 0, doorRepairs: 0, floorRepairs: 0, routeRepairs: 0, targets: 0, unreachableBefore: 0, reachableAfter: 0 };
  const footprint = (x: number, y: number) => raster.buildings.some(b => x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.depth);
  const key = (x: number, y: number) => x + y * 24;
  const neighbors = (k: number) => { const x = k % 24, y = Math.floor(k / 24); return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([x, y]) => x! >= 0 && y! >= 0 && x! < 24 && y! < 24).map(([x, y]) => key(x!, y!)); };
  const reachable = () => {
    const seen = new Set<number>(), queue: number[] = [];
    if (world.isWalkable(raster.spawn.x, raster.spawn.y, 1)) { queue.push(key(raster.spawn.x, raster.spawn.y)); seen.add(queue[0]!); }
    for (let i = 0; i < queue.length; i++) for (const next of neighbors(queue[i]!)) if (!seen.has(next) && world.isWalkable(next % 24, Math.floor(next / 24), 1)) { seen.add(next); queue.push(next); }
    return seen;
  };
  const targets = new Set<number>();
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) if (raster.layers[0]![y]![x] === "p" && !footprint(x, y)) targets.add(key(x, y));
  for (const b of raster.buildings) targets.add(key(b.door.x, b.door.y));
  report.targets = targets.size;
  const before = reachable();
  report.unreachableBefore = [...targets].filter(k => !before.has(k)).length;
  const set = (x: number, y: number, z: number, tile: keyof typeof RASTER_LEGEND, kind: "wallRepairs" | "doorRepairs" | "floorRepairs" | "routeRepairs") => {
    if (world.getCell(x, y, z) === RASTER_LEGEND[tile]) return;
    world.setCell(x, y, z, RASTER_LEGEND[tile]); report.changedCells++; report[kind]++;
    const row = raster.layers[z]![y]!; raster.layers[z]![y] = row.slice(0, x) + tile + row.slice(x + 1);
  };
  const pave = (x: number, y: number, kind: "doorRepairs" | "routeRepairs") => {
    if (!world.isWalkable(x, y, 1)) {
      const ground = world.getMaterial(x, y, 0);
      if (!ground.solid || !ground.walkable) set(x, y, 0, "p", kind);
      set(x, y, 1, ".", kind); set(x, y, 2, ".", kind);
    }
  };
  for (const [i, b] of raster.buildings.entries()) {
    const right = b.x + b.width - 1, bottom = b.y + b.depth - 1;
    for (let y = b.y; y <= bottom; y++) for (let x = b.x; x <= right; x++) {
      set(x, y, 0, "f", "floorRepairs"); set(x, y, 3, "r", "wallRepairs");
      if ((x === b.x || x === right || y === b.y || y === bottom) && (x !== b.door.x || y !== b.door.y)) { set(x, y, 1, "#", "wallRepairs"); set(x, y, 2, "#", "wallRepairs"); }
    }
    set(b.door.x, b.door.y, 1, ".", "doorRepairs"); set(b.door.x, b.door.y, 2, ".", "doorRepairs");
    const dx = b.door.x === b.x ? 1 : b.door.x === right ? -1 : 0;
    const dy = b.door.y === b.y ? 1 : b.door.y === bottom ? -1 : 0;
    pave(b.door.x + dx, b.door.y + dy, "doorRepairs");
    world.addStructure({ id: `raster-building-${i}`, kind: "building", name: b.name, bounds: box(b.x, b.y, 1, right + 1, bottom + 1, 3) });
  }
  pave(raster.spawn.x, raster.spawn.y, "routeRepairs");
  // Exterior BFS preserves building walls. Routes only clear obstacles where a target is disconnected.
  for (const target of targets) {
    if (reachable().has(target)) continue;
    const previous = new Map<number, number>(), start = key(raster.spawn.x, raster.spawn.y), queue = [start];
    previous.set(start, start);
    for (let i = 0; i < queue.length && !previous.has(target); i++) for (const next of neighbors(queue[i]!)) {
      if (previous.has(next) || (footprint(next % 24, Math.floor(next / 24)) && next !== target)) continue;
      previous.set(next, queue[i]!); queue.push(next);
    }
    if (!previous.has(target)) throw new RangeError("No exterior route to raster target.");
    let current = target;
    while (current !== start) { pave(current % 24, Math.floor(current / 24), "routeRepairs"); current = previous.get(current)!; }
  }
  const after = reachable(); report.reachableAfter = [...targets].filter(k => after.has(k)).length;
  return { world, raster, report };
}

/** Clearly labelled offline fixture, never passed off as a model output. */
export function createRasterExample(name = "The botanist's cottage"): RasterMap {
  const layers = Array.from({ length: 4 }, (_, z) => Array.from({ length: 24 }, () => (z === 0 ? "g" : ".").repeat(24)));
  const raw: RasterMap = { version: 1, name, layers, spawn: { x: 12, y: 19 }, buildings: [{ name: "Home", x: 8, y: 6, width: 8, depth: 8, door: { x: 12, y: 13 } }] };
  layers[1]![9] = layers[1]![9]!.slice(0, 10) + "b" + layers[1]![9]!.slice(11);
  return compileRasterMap(raw).raster;
}
