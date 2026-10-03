import { describe, expect, it } from "vitest";
import { AIR } from "@evermore/world";
import { compare, screenToGround, groundToScreen, type ComparisonSettings } from "./projection";
import { reconstruct, type Raster } from "./model";
import { parseVisionProposal, type VisionProposal } from "./vision";
import type { Annotation } from "./annotations";
import cabin from "../../../public/image-to-voxel/cabin-vision.json";
import harbour from "../../../public/image-to-voxel/harbour-vision.json";

const expected = { sourceId: "test", width: 16, height: 16, tileSize: 8 };
const proposal: VisionProposal = { ...expected, tiles: Array.from({ length: 4 }, (_, i) => ({ x: i % 2, y: Math.floor(i / 2), level: 4, region: "roof" })) };
const raster: Raster = { width: 16, height: 16, data: new Uint8ClampedArray(16 * 16 * 4).fill(204) };
const settings: ComparisonSettings = { tileSize: 8, heightScale: 6, method: "vision", projection: "projected", useAnchors: false };
const annotation: Annotation = { id: "roof", label: "roof", kind: "roof", polygon: [[0,0],[.5,0],[.5,.5],[0,.5]], groundAnchor: [.25,.6], baseAnchor: [.25,.6], probe: [.25,.25], level: 4 };

describe("strict vision proposals", () => {
  it("accepts complete real cached responses and sorts tiles by their coordinates", () => {
    for (const [id, cache] of [["cabin", cabin], ["harbour", harbour]] as const) {
      expect(parseVisionProposal(cache.proposal, { sourceId: id, width: 1376, height: 768, tileSize: 64 }).tiles).toHaveLength(264);
    }
    const input = { ...proposal, tiles: [...proposal.tiles].reverse() };
    expect(parseVisionProposal(input, expected).tiles[0]).toEqual(proposal.tiles[0]);
  });
  it("rejects missing, duplicate, off-grid, fractional and foreign-source tiles", () => {
    expect(() => parseVisionProposal({ ...proposal, tiles: proposal.tiles.slice(1) }, expected)).toThrow("every tile");
    for (const change of [{ x: 2 }, { y: -1 }, { level: 6 }, { level: 1.5 }, { region: "lava" }, { extra: true }]) {
      const tiles = structuredClone(proposal.tiles); Object.assign(tiles[0]!, change);
      expect(() => parseVisionProposal({ ...proposal, tiles }, expected)).toThrow();
    }
    expect(() => parseVisionProposal({ ...proposal, tiles: [proposal.tiles[1], ...proposal.tiles.slice(1)] }, expected)).toThrow("Duplicate");
    expect(() => parseVisionProposal({ ...proposal, sourceId: "other" }, expected)).toThrow("sourceId");
    expect(() => parseVisionProposal({ ...proposal, tileSize: 16 }, expected)).toThrow("tileSize");
  });
  it("rejects elevated water and decks below water", () => {
    for (const tile of [{ region: "water", level: 1 }, { region: "bridge", level: 0 }]) {
      expect(() => parseVisionProposal({ ...proposal, tiles: [{ ...proposal.tiles[0], ...tile }, ...proposal.tiles.slice(1)] }, expected)).toThrow();
    }
  });
});
describe("ground projection diagnostics", () => {
  it("inverts the fixed camera equation and bounds rounding error", () => {
    expect(groundToScreen(screenToGround(4.2, 3), 3)).toBeCloseTo(4.2);
    const result = compare(raster, settings, [], undefined, proposal);
    expect(result.metrics.maxProjectionErrorPx).toBeLessThanOrEqual(8 * Math.SQRT1_2 / 2);
    const relief = compare(raster, { ...settings, projection: "relief" }, [], undefined, proposal);
    expect(result.metrics.meanProjectionErrorPx).toBeLessThan(relief.metrics.meanProjectionErrorPx);
  });
  it("keeps the original relief geometry and raw levels at zero height scale", () => {
    const baseline = reconstruct(raster, { tileSize: 8, heightScale: 6, method: "heightmap" }, raster);
    const result = compare(raster, { ...settings, method: "heightmap", projection: "relief" }, [], raster).result;
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) for (let z = 0; z < 10; z++) expect(result.world.getCell(x,y,z)).toBe(baseline.world.getCell(x,y,z));
    const flat = compare(raster, { ...settings, heightScale: 0 }, [annotation], undefined, proposal);
    expect(flat.metrics.heightErrors[0]!.actual).toBe(4);
    expect(flat.samples.every(s => s.height === 1)).toBe(true);
  });
  it("moves roof footprint with edited contact, but leaves relief independent of anchors", () => {
    const edited = { ...annotation, groundAnchor: [.25,1] as [number,number] };
    const run = (a: Annotation, projection: ComparisonSettings["projection"]) => compare(raster, { ...settings, useAnchors: true, projection }, [a], undefined, proposal);
    expect(run(edited, "projected").samples[0]!.ground[1]).toBeGreaterThan(run(annotation, "projected").samples[0]!.ground[1]);
    expect(run(edited, "relief").samples).toEqual(run(annotation, "relief").samples);
  });
  it("applies wall height corrections and recovers hand-labelled unknown tiles", () => {
    const wall: Annotation = { ...annotation, kind: "wall", level: 0, groundAnchor: [.25, 1] };
    const tiles = structuredClone(proposal.tiles); tiles[0]!.region = "unknown";
    const run = compare(raster, { ...settings, useAnchors: true }, [wall], undefined, { ...proposal, tiles });
    expect(run.metrics.unknown).toBe(0);
    expect(run.samples[0]!.height).toBe(1);
    expect(run.samples[0]!.level).toBe(0);
    expect(run.result.tiles.some(tile => tile.height === 1 && tile.level === 0)).toBe(true);
    expect(compare(raster, { ...settings, useAnchors: true }, [{ ...wall, level: 5 }], undefined, proposal).samples[0]!.height).toBeGreaterThan(1);
  });
  it("counts local mask mismatch and leaves unknown tiles empty", () => {
    const result = compare(raster, settings, [annotation], undefined, proposal);
    expect(result.metrics.maskIoU.roof).toBe(.25);
    const tiles = structuredClone(proposal.tiles); tiles[0]!.region = "unknown";
    const unknown = compare(raster, settings, [], undefined, { ...proposal, tiles });
    expect(unknown.metrics.unknown).toBe(1);
    expect(unknown.samples).toHaveLength(3);
    expect(unknown.result.world.getCell(0,0,0)).toBe(AIR);
  });
});
