import { describe, expect, it } from "vitest";
import { decodeColourMask, emptyMasks, gridMasks, occluded, paintMasks, parseRegions, rasterizeRegions, safeSpawn, walkable } from "./model";
import { createMovement, DEFAULT_MOVEMENT, stepMovement } from "@evermore/core";
import { parseMaskInput } from "./generation";
const rectangle = (kind: "collision" | "overhead" | "free", left: number, top: number, right: number, bottom: number) => ({label: kind, kind, polygon: [[left, top], [right, top], [right, bottom], [left, bottom]] as [number, number][]});
describe("registered map masks", () => {
  it("decodes independent collision and overhead classes", () => {
    const masks = decodeColourMask(4, 1, [255,255,255,255, 0,0,0,255, 255,0,0,255, 255,0,255,255]);
    expect([...masks.collision]).toEqual([0,1,0,1]);
    expect([...masks.overhead]).toEqual([0,0,1,1]);
    expect(() => decodeColourMask(1,1,[0,0,0,0])).toThrow(/unknown/);
  });
  it("keeps a bridge or door free even if the solid polygon arrives later", () => {
    const masks = rasterizeRegions(100,100,[rectangle("free",400,0,600,1000), rectangle("collision",0,0,1000,1000), rectangle("overhead",0,0,1000,500)]);
    expect(walkable(masks,50,75)).toBe(true);
    expect(walkable(masks,30,75)).toBe(false);
    expect(masks.overhead[25*100+50]).toBe(1);
  });
  it("reduces partial edge cells conservatively and rejects zero-size grids", () => {
    const masks=emptyMasks(19,19);masks.collision[18*19+18]=1;masks.overhead[0]=1;
    const cells=gridMasks(masks,16);
    expect(cells.collision[16*19+16]).toBe(1);
    expect(cells.collision[15*19+15]).toBe(0);
    expect(cells.overhead[15*19+15]).toBe(1);
    expect(() => gridMasks(masks,0)).toThrow();
  });
  it("tests only feet for collision, uses the head for occlusion, and finds a safe spawn", () => {
    const masks=emptyMasks(64,64);masks.overhead[20*64+32]=1;masks.collision[45*64+32]=1;
    expect(walkable(masks,32,40)).toBe(true);
    expect(occluded(masks,32,40)).toBe(true);
    expect(walkable(masks,32,45)).toBe(false);
    const spawn=safeSpawn(masks,{x:32,y:45})!;
    expect(walkable(masks,spawn.x,spawn.y)).toBe(true);
    masks.collision.fill(1);expect(safeSpawn(masks)).toBeUndefined();
  });
  it("rejects malformed regions and unsupported extraction settings", () => {
    expect(() => parseRegions([rectangle("collision",-1,0,100,100)])).toThrow();
    expect(() => parseMaskInput({source:"cabin",approach:"image",model:"gemini-3.5-flash-lite"})).toThrow();
    expect(() => parseMaskInput({source:"live",approach:"vision",image:"https://example.org/map"})).toThrow();
    expect(parseMaskInput({source:"cabin",approach:"image"}).model).toBe("gemini-3.1-flash-lite-image");
  });
  it("stops the entire feet rectangle before fractional image edges", () => {
    const masks = emptyMasks(64, 64);
    expect(walkable(masks, 59.8, 30)).toBe(false);
    expect(walkable(masks, 30, 61.8)).toBe(false);
    expect(walkable(masks, NaN, 30)).toBe(false);
  });
  it("paints continuous source-pixel strokes and preserves the original output", () => {
    const original = emptyMasks(100, 100);
    const painted = paintMasks(original, {x:10,y:50}, {x:90,y:50}, 3, "both");
    expect(painted.collision[50*100+50]).toBe(1);
    expect(painted.overhead[50*100+50]).toBe(1);
    expect(original.collision[50*100+50]).toBe(0);
    const cleared = paintMasks(painted, {x:50,y:50}, {x:50,y:50}, 4, "clear-collision");
    expect(cleared.collision[50*100+50]).toBe(0);
    expect(cleared.overhead[50*100+50]).toBe(1);
    expect(gridMasks(cleared,16).collision[50*100+50]).toBe(1);
  });
  it("uses R2 movement to stop at water and walls while allowing bridges and roof occlusion", () => {
    const masks = rasterizeRegions(160,160,[rectangle("collision",0,600,1000,800), rectangle("free",400,550,600,850), rectangle("collision",100,100,300,300), rectangle("overhead",100,50,300,200)]);
    const move = (x:number,y:number,dx:number,dy:number,steps:number) => {
      const state = createMovement({x:x/16,y:y/16,z:0});
      for(let i=0;i<steps;i++)stepMovement(state,{x:dx,y:dy},{...DEFAULT_MOVEMENT,cornerTolerance:0},p=>walkable(masks,p.x*16,p.y*16)?0:null);
      return {x:state.x*16,y:state.y*16};
    };
    expect(move(100,80,0,1,120).y).toBeLessThan(94);
    expect(move(80,80,0,1,70).y).toBeGreaterThan(128);
    expect(move(60,40,-1,0,60).x).toBeGreaterThan(51);
    const behindRoof = move(60,10,-1,0,30);
    expect(occluded(masks,behindRoof.x,behindRoof.y)).toBe(true);
    const diagonal=move(80,40,1,1,20),cardinal=move(80,40,1,0,20);
    expect(Math.hypot(diagonal.x-80,diagonal.y-40)).toBeCloseTo(cardinal.x-80,4);
  });
});
