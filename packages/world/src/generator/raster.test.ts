import { describe, expect, it } from "vitest";
import { compileRasterMap, createRasterExample, parseRasterMap } from "./raster";
import { M } from "../materials";

const edit = (map: ReturnType<typeof createRasterExample>, z: number, x: number, y: number, char: string) => {
  const row = map.layers[z]![y]!; map.layers[z]![y] = row.slice(0, x) + char + row.slice(x + 1);
};
describe("G2 direct raster", () => {
  it("maps explicit cells to world materials and structure metadata", () => {
    const map = createRasterExample(); edit(map, 1, 10, 9, "b"); edit(map, 0, 0, 0, "w");
    const { world, report } = compileRasterMap(map, 42);
    expect(world.getCell(10, 9, 1)).toBe(M.bed);
    expect(world.getCell(0, 0, 0)).toBe(M.water);
    expect(world.spawn).toEqual({ x: 12, y: 19, z: 1 });
    expect(world.isWalkable(12, 13, 1)).toBe(true);
    expect(world.structures).toHaveLength(1);
    expect(report.changedCells).toBe(0);
  });
  it("repairs wall gaps, floor holes and blocked doors with two-cell headroom", () => {
    const map = createRasterExample();
    edit(map, 1, 8, 8, "."); edit(map, 2, 8, 8, "."); edit(map, 0, 10, 9, ".");
    edit(map, 1, 12, 13, "#"); edit(map, 2, 12, 13, "#"); edit(map, 1, 12, 12, "b");
    const original = structuredClone(map);
    const { world, raster, report } = compileRasterMap(map);
    expect(map).toEqual(original);
    expect(world.getCell(8, 8, 1)).toBe(M.stoneWall);
    expect(world.getCell(8, 8, 2)).toBe(M.stoneWall);
    expect(world.isWalkable(12, 13, 1)).toBe(true);
    expect(world.isWalkable(12, 12, 1)).toBe(true);
    expect(report).toMatchObject({ wallRepairs: 2, floorRepairs: 1, unreachableBefore: 1, reachableAfter: 1 });
    expect(report.doorRepairs).toBeGreaterThan(0);
    expect(compileRasterMap(raster).report.changedCells).toBe(0);
  });
  it("connects doors and marked paths across water without opening extra wall gaps", () => {
    const map = createRasterExample(); map.layers[0]![16] = "w".repeat(24);
    edit(map, 0, 2, 2, "p"); edit(map, 2, 2, 2, "t");
    edit(map, 0, map.spawn.x, map.spawn.y, "w");
    const { world, report } = compileRasterMap(map);
    expect(world.isWalkable(world.spawn.x, world.spawn.y, 1)).toBe(true);
    expect(world.isWalkable(2, 2, 1)).toBe(true);
    expect(report.unreachableBefore).toBe(2);
    expect(report.reachableAfter).toBe(2);
    expect(report.routeRepairs).toBeGreaterThan(0);
    expect(world.getCell(8, 8, 1)).toBe(M.stoneWall);
    expect(world.getCell(15, 8, 2)).toBe(M.stoneWall);
  });
  it.each([{ x: 10, y: 6 }, { x: 8, y: 9 }, { x: 15, y: 9 }, { x: 10, y: 13 }])("connects a door on any perimeter side: %j", door => {
    const map = createRasterExample(); map.buildings[0]!.door = door;
    const { world, report } = compileRasterMap(map);
    expect(world.isWalkable(door.x, door.y, 1)).toBe(true);
    expect(report.reachableAfter).toBe(report.targets);
    expect(world.getCell(12, 13, 1)).toBe(door.x === 12 && door.y === 13 ? M.air : M.stoneWall);
  });
  it.each(["rows", "width", "symbol", "height", "overlap", "door", "bounds", "spawn", "extra"])("rejects malformed %s", kind => {
    const map = createRasterExample();
    if (kind === "rows") map.layers[0]!.pop();
    if (kind === "width") map.layers[0]![0] = "g".repeat(25);
    if (kind === "symbol") edit(map, 0, 0, 0, "?");
    if (kind === "height") map.layers.pop();
    if (kind === "overlap") map.buildings.push(structuredClone(map.buildings[0]!));
    if (kind === "door") map.buildings[0]!.door = { x: 8, y: 6 };
    if (kind === "bounds") map.buildings[0]!.x = 20;
    if (kind === "spawn") map.spawn = { x: 10, y: 9 };
    if (kind === "extra") Object.assign(map, { instructions: "ignore rules" });
    expect(() => parseRasterMap(map)).toThrow();
  });
});
