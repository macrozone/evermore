import { describe, expect, it } from "vitest";
import { doorPassage, nearDoor } from "./model";
import { emptyMasks, walkable } from "../g3b-map/model";
import { reachableInterior } from "./reachability";
import { parseInteriorInput } from "./generation";
describe("interior thresholds",()=>{
  it("opens only a narrow annotated threshold and preserves original model masks",()=>{
    const source=emptyMasks(100,100);source.collision.fill(1);source.overhead.fill(1);
    const result=doorPassage(source,{x:50,y:30});
    expect(walkable(result.masks,result.spawn.x,result.spawn.y)).toBe(true);
    expect(walkable(result.masks,20,40)).toBe(false);
    expect(source.collision[30*100+50]).toBe(1);
    expect(result.masks.overhead[30*100+50]).toBe(0);
  });
  it("bounds an exit marker at the picture edge and places returning feet inside the image",()=>{
    const {door,spawn,masks}=doorPassage(emptyMasks(128,128),{x:64,y:128});
    expect(door.y).toBe(112);expect(walkable(masks,spawn.x,spawn.y)).toBe(true);
    expect(nearDoor(spawn,door)).toBe(true);
    expect(nearDoor({x:10,y:10},door)).toBe(false);
  });
  it("permits only the shared image and vision models",()=>{
    expect(parseInteriorInput({})).toEqual({model:"gemini-3.1-flash-lite-image",maskModel:"gemini-3.5-flash-lite"});
    expect(()=>parseInteriorInput({model:"foreign"})).toThrow();
    expect(()=>parseInteriorInput({maskModel:"foreign"})).toThrow();
  });
});

it("rejects an all-blocked room even when the exit has a small free polygon",()=>{
  const base={approach:"vision" as const,model:"test",width:128,height:128,durationMs:0,estimatedCostUsd:0,costBasis:"usage" as const,generatedAt:"",regions:[{label:"bad-wall-box",kind:"collision" as const,polygon:[[0,0],[1000,0],[1000,1000],[0,1000]] as [number,number][]}]};
  expect(reachableInterior(base,{x:64,y:112})).toBe(false);
  expect(reachableInterior({...base,regions:[{...base.regions[0]!,polygon:[[0,0],[1000,0],[1000,100],[0,100]]}]},{x:64,y:112})).toBe(true);
});
