import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { callVertex, MapLimitError, MapProviderError } from "../g3-map/generate";
import { callMaskVertex, sourceBytes } from "../g3b-map/generate";
import { VISION_INSTRUCTION, maskReservation } from "../../../lab/g3b-map/generation";
import { INTERIOR_INSTRUCTION, MAP_MODELS, type Interior, type InteriorInput } from "../../../lab/m1-walk/generation";

import { reachableInterior } from "../../../lab/m1-walk/reachability";
export { MapLimitError, MapProviderError };
export const INTERIOR_MASK_INSTRUCTION = `${VISION_INSTRUCTION}\nThis is an interior room. IMPORTANT: Never mark the whole room or the bounding rectangle of all walls as blocked! Trace each wall separately as a NARROW STRIP (north, east, west, south except doorway). The large central wooden floor must remain walkable and connected to the exit. Regions need descriptive labels (north-wall, west-wall, bed, table, fireplace etc.). Walls, bed, fireplace, shelving, tables and chairs are blocked ground footprints. Table tops and tall furnishings may also be overhead. Include all furniture. Leave the connected wooden floor free. Add exactly one free polygon labelled exit-door around the open SOUTH doorway/threshold; no other region should use that label.`;
export async function interiorProvider(input: InteriorInput, source: Awaited<ReturnType<typeof sourceBytes>>) {
  const started=Date.now();
  const picture=await callVertex({model:input.model,seed:1,prompt:"Forest cottage interior"},{bytes:source.bytes,instruction:INTERIOR_INSTRUCTION});
  let image:Buffer<ArrayBuffer>,width:number,height:number;
  try {
    const meta=await sharp(picture.bytes,{limitInputPixels:2048*2048}).metadata();
    if(meta.width===undefined||meta.height===undefined||meta.width>2048||meta.height>2048)throw new Error("dimensions");
    width=meta.width;height=meta.height;image=await sharp(picture.bytes).png().toBuffer();
    if(image.length>6_000_000)throw new Error("size");
  }catch{throw new MapProviderError("Interior exceeds the image size limit.");}
  const imageDurationMs=Date.now()-started,maskStarted=Date.now();
  const output=await callMaskVertex({source:"live",image:`data:image/png;base64,${image.toString("base64")}`,approach:"vision",model:input.maskModel},{bytes:image,width,height},INTERIOR_MASK_INSTRUCTION);
  const exit=output.regions?.find(r=>r.kind==="free"&&r.label==="exit-door");
  if(!exit)throw new MapProviderError("No interior exit found. Try another mask model.");
  const door={x:exit.polygon.reduce((s,p)=>s+p[0],0)/exit.polygon.length*width/1000,y:exit.polygon.reduce((s,p)=>s+p[1],0)/exit.polygon.length*height/1000};
  if(!reachableInterior({...output,durationMs:0,generatedAt:""},door))throw new MapProviderError("Interior floor is inaccessible. Try another mask model.");
  return {image:`data:image/png;base64,${image.toString("base64")}`,width,height,door,model:input.model,durationMs:imageDurationMs,estimatedCostUsd:picture.cost,generatedAt:new Date().toISOString(),mask:{...output,durationMs:Date.now()-maskStarted,generatedAt:new Date().toISOString()}};
}
/** Separate bounded budget covers BOTH calls, including failed pipelines. */
export function createInteriorGenerator(provider=interiorProvider,load=()=>sourceBytes({source:"cabin",approach:"vision",model:"gemini-3.5-flash-lite"}),now=Date.now) {
  const cache=new Map<string,Interior>(),pending=new Map<string,Promise<Interior>>();
  let reservations:{time:number;usd:number}[]=[];
  const budget=()=>{reservations=reservations.filter(r=>r.time>now()-3_600_000);return {calls:reservations.length,callLimit:8,reservedUsd:reservations.reduce((s,r)=>s+r.usd,0),limitUsd:1};};
  async function generate(input:InteriorInput) {
    const started=now(),source=await load();
    const id=createHash("sha256").update(source.bytes).update(JSON.stringify([input,INTERIOR_INSTRUCTION,INTERIOR_MASK_INSTRUCTION])).digest("hex");
    const wrap=(room:Interior,cached:boolean)=>({room,cached,durationMs:now()-started,requestCostUsd:cached?0:room.estimatedCostUsd+room.mask.estimatedCostUsd});
    const hit=cache.get(id);if(hit)return wrap(hit,true);
    const active=pending.get(id);if(active)return wrap(await active,true);
    const model=MAP_MODELS.find(m=>m.id===input.model)!;
    const usd=(5000*model.inputPerMillion+4096*model.imagePerMillion)/1e6+maskReservation({source:"live",approach:"vision",model:input.maskModel});
    const b=budget();if(b.calls>=b.callLimit||b.reservedUsd+usd>b.limitUsd)throw new MapLimitError("Hourly interior budget exhausted. Use the saved room or wait.");
    reservations.push({time:now(),usd});
    const work=(async()=>{const output=await provider(input,source);const room={...output,id};if(cache.size>=4)cache.delete(cache.keys().next().value!);cache.set(id,room);return room;})().finally(()=>pending.delete(id));
    pending.set(id,work);return wrap(await work,false);
  }
  return {generate,budget};
}
const state=globalThis as typeof globalThis & {m1Interior?:ReturnType<typeof createInteriorGenerator>};
export const interiorGenerator=state.m1Interior??=createInteriorGenerator();
