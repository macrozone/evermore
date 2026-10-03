import type { Vec3 } from "../geometry";
import { M } from "../materials";
import { createRng } from "../rng";
import { generateWorld } from "./generate";
import { WORLD_EXAMPLES } from "./examples";

/** Renderer-independent library data. Coordinates run east/south from the footprint's northwest cell. */
export interface VillageObject {
  id: string;
  kind: "building" | "vegetation" | "decoration";
  footprint: { columns: number; rows: number; occupied: readonly (readonly [number, number])[]; collision: readonly (readonly [number, number])[] };
  /** Walkable approach immediately south of a building, outside its footprint. */
  entrance?: { x: number; y: number };
}
export interface ObjectPlacement {
  id: string;
  objectId: string;
  position: Vec3;
  entrance?: Vec3;
}
export interface VillageOptions { size: number; buildings: number; edgeDensity: number }
export const DEFAULT_VILLAGE: VillageOptions = { size: 128, buildings: 24, edgeDensity: 0.12 };

/** G3: G1 terrain plus reusable library objects. No rendering or model requests. */
export function generateObjectVillage(library: readonly VillageObject[], seed: number | string, options: VillageOptions = DEFAULT_VILLAGE) {
  const { size, buildings, edgeDensity } = options;
  if (!Number.isInteger(size) || size < 48 || size > 128 || !Number.isInteger(buildings) || buildings < 0 || buildings > 100 || !Number.isFinite(edgeDensity) || edgeDensity < 0 || edgeDensity > 0.3) throw new RangeError("Invalid village settings");
  const ids = new Set<string>();
  for (const object of library) {
    const { columns, rows, occupied, collision } = object.footprint;
    if (object.id === "" || ids.has(object.id) || !Number.isInteger(columns) || columns < 1 || columns > 12 || !Number.isInteger(rows) || rows < 1 || rows > 12 || occupied.length === 0) throw new RangeError("Invalid object footprint");
    ids.add(object.id);
    const cells = new Set<string>();
    for (const [x, y] of occupied) {
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= columns || y < 0 || y >= rows || cells.has(`${x},${y}`)) throw new RangeError("Invalid occupied cell");
      cells.add(`${x},${y}`);
    }
    if (collision.some(([x, y]) => !cells.has(`${x},${y}`))) throw new RangeError("Collision must be inside occupied cells");
    if (object.kind === "building" && (!object.entrance || !Number.isInteger(object.entrance.x) || object.entrance.x < 0 || object.entrance.x >= columns || object.entrance.y !== rows)) throw new RangeError("Building requires a south entrance approach");
  }
  const houses = library.filter(object => object.kind === "building");
  if (houses.length === 0) throw new RangeError("Village requires building objects");
  const center = Math.floor(size / 2);
  const world = generateWorld({ ...WORLD_EXAMPLES[0]!, name: "Library village", size: { width: size, depth: size, height: 16 }, terrain: { elevation: 3, relief: 0, scale: 16 }, water: { kind: "none", level: 1 }, vegetation: { density: 0 }, settlement: { buildings: [] }, paths: false, landmarks: [], spawn: { x: center, y: center + 4 } }, seed);
  const rng = createRng(seed);
  const placements: ObjectPlacement[] = [];
  const reserved = new Set<number>();
  const key = (x: number, y: number) => x + y * size;
  const pave = (x: number, y: number) => {
    world.setCell(x, y, 2, M.stoneFloor);
    reserved.add(key(x, y));
  };
  // A central plaza and a north/south spine connect every residential lane.
  for (let y = 2; y < size - 2; y++) for (let x = center - 1; x <= center + 1; x++) pave(x, y);
  for (let y = center - 4; y <= center + 4; y++) for (let x = center - 4; x <= center + 4; x++) pave(x, y);
  const lotWidth = Math.max(...houses.map(house => house.footprint.columns)) + 5;
  const lotDepth = Math.max(...houses.map(house => house.footprint.rows)) + 8;
  const lots: { x: number; y: number; lane: number }[] = [];
  for (let y = 9; y + lotDepth < size - 7; y += lotDepth) {
    const lane = y + lotDepth - 4;
    for (let x = 7; x < size - 7; x++) for (let dy = 0; dy < 2; dy++) pave(x, lane + dy);
    for (let x = 9; x + lotWidth < size - 7; x += lotWidth) lots.push({ x, y, lane });
  }
  // Seeded shuffle selects occupied lots without bias toward one corner.
  for (let i = lots.length - 1; i > 0; i--) { const j = rng.int(0, i); [lots[i], lots[j]] = [lots[j]!, lots[i]!]; }
  const place = (object: VillageObject, x: number, y: number, apron = 0) => {
    const { columns, rows, occupied, collision } = object.footprint;
    for (let py = y - apron; py < y + rows + apron; py++) for (let px = x - apron; px < x + columns + apron; px++) {
      if (px < 1 || py < 1 || px >= size - 1 || py >= size - 1 || reserved.has(key(px, py))) return false;
    }
    const entrance = object.entrance ? { x: x + object.entrance.x, y: y + object.entrance.y, z: 3 } : undefined;
    placements.push({ id: `object-${placements.length}`, objectId: object.id, position: { x, y, z: 3 }, ...(entrance ? { entrance } : {}) });
    for (const [dx, dy] of occupied) reserved.add(key(x + dx, y + dy));
    // Two solid cells stop the shared movement probe from stepping onto objects.
    for (const [dx, dy] of collision) for (let z = 3; z < 5; z++) world.setCell(x + dx, y + dy, z, M.stoneWall);
    return true;
  };
  for (const lot of lots) {
    if (placements.filter(p => p.entrance).length >= buildings) break;
    const object = rng.pick(houses);
    const x = lot.x + rng.int(0, 1), y = lot.y;
    if (!place(object, x, y, 1)) continue;
    const door = placements[placements.length - 1]!.entrance!;
    for (let py = door.y; py <= lot.lane; py++) pave(door.x, py);
    // Keep a clear apron for the player's finite collision radius.
    for (let px = x - 1; px <= x + object.footprint.columns; px++) reserved.add(key(px, door.y));
  }
  // Show a reusable house immediately while retaining the plaza for empty villages.
  const nearestDoor = placements.flatMap(p => p.entrance ? [p.entrance] : [])
    .sort((a, b) => (a.x - center) ** 2 + (a.y - center) ** 2 - ((b.x - center) ** 2 + (b.y - center) ** 2))[0];
  if (nearestDoor) {
    world.spawn = { ...nearestDoor, y: nearestDoor.y + 1 };
    reserved.add(key(world.spawn.x, world.spawn.y));
  }
  const vegetation = library.filter(object => object.kind === "vegetation");
  const decorations = library.filter(object => object.kind === "decoration");
  for (let y = 2; y < size - 2; y++) for (let x = 2; x < size - 2; x++) {
    const edge = Math.min(x, y, size - 1 - x, size - 1 - y) < 7;
    if (edge && vegetation.length > 0 && rng.chance(edgeDensity)) place(rng.pick(vegetation), x, y, 1);
    else if (!edge && decorations.length > 0 && rng.chance(0.003)) place(rng.pick(decorations), x, y, 1);
  }
  return { world, placements, requestedBuildings: buildings, placedBuildings: placements.filter(p => p.entrance).length };
}
