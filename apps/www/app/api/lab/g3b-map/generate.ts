import "server-only";
import { GoogleAuth } from "google-auth-library";
import { createHash } from "node:crypto";
import { readMoodboardImage } from "../../../../lib/moodboards";
import sharp from "sharp";
import { MAP_MODELS, VISION_MODELS, IMAGE_INSTRUCTION, VISION_INSTRUCTION, maskReservation, type MaskInput } from "../../../lab/g3b-map/generation";
import { parseRegions, SOURCES, type MaskResult } from "../../../lab/g3b-map/model";
import { MapLimitError, MapProviderError } from "../g3-map/generate";
export { MapLimitError, MapProviderError };
const auth = new GoogleAuth({scopes:["https://www.googleapis.com/auth/cloud-platform"]});
export async function sourceBytes(input: MaskInput) {
  const bytes=input.source === "live" ? Buffer.from(input.image!.split(",")[1]!,"base64") : await readMoodboardImage("02-eigene-welt", SOURCES.find(s=>s.id===input.source)!.url.split("/").at(-1)!);
  if (!bytes) throw new MapProviderError("Source image is unavailable.");
  const meta=await sharp(bytes,{limitInputPixels:2048*2048}).metadata();
  if(meta.width===undefined || meta.height===undefined || meta.width>2048 || meta.height>2048) throw new MapProviderError("Source exceeds 2048 × 2048.");
  return {bytes:await sharp(bytes).png().toBuffer(),width:meta.width,height:meta.height};
}
type Source=Awaited<ReturnType<typeof sourceBytes>>;
type Payload={ candidates?: {finishReason?:string;content?:{parts?:{text?:string;thought?:boolean;inlineData?:{data:string;mimeType:string}}[]}}[];usageMetadata?:{promptTokenCount?:number;candidatesTokenCount?:number;thoughtsTokenCount?:number} };
export async function callMaskVertex(input: MaskInput, source: Source):Promise<Omit<MaskResult,"durationMs"|"generatedAt">> {
  if(process.env.NODE_ENV!=="development") throw new MapProviderError("Live masks require local development.");
  const project=process.env.GOOGLE_CLOUD_PROJECT??"maw-evermore";
  if(!/^[a-z][a-z0-9-]+$/.test(project)) throw new MapProviderError("Invalid Vertex project.");
  let headers:Headers,timer:ReturnType<typeof setTimeout>|undefined;
  try { headers=new Headers(await Promise.race([auth.getRequestHeaders(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("timeout")),10_000);})])); }
  catch {throw new MapProviderError("Vertex credentials unavailable. Use local ADC.");}finally{clearTimeout(timer);}
  headers.set("Content-Type","application/json");headers.set("x-goog-user-project",project);
  let response:Response;
  try {response=await fetch(`https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${input.model}:generateContent`,{
    method:"POST",headers,cache:"no-store",signal:AbortSignal.timeout(120_000),body:JSON.stringify({contents:[{role:"user",parts:[{text:input.approach==="image"?IMAGE_INSTRUCTION:VISION_INSTRUCTION},{inlineData:{mimeType:"image/png",data:source.bytes.toString("base64")}}]}],generationConfig:input.approach==="image"?{maxOutputTokens:4096,responseModalities:["IMAGE"],imageConfig:{imageSize:"1K",aspectRatio:Math.abs(source.width/source.height-1)<.1?"1:1":"16:9"}}:{maxOutputTokens:16384,responseMimeType:"application/json",responseSchema:{type:"OBJECT",properties:{regions:{type:"ARRAY",items:{type:"OBJECT",properties:{label:{type:"STRING"},kind:{type:"STRING",enum:["collision","overhead","free"]},polygon:{type:"ARRAY",items:{type:"ARRAY",items:{type:"NUMBER",minimum:0,maximum:1000}}}},required:["label","kind","polygon"]}}},required:["regions"]},thinkingConfig:{thinkingLevel:input.model==="gemini-3.5-flash-lite"?"MINIMAL":"LOW"}}})});}
  catch {throw new MapProviderError("Vertex timed out or could not connect. No fallback used.");}
  if(!response.ok){await response.body?.cancel();throw new MapProviderError(`Vertex returned HTTP ${response.status} for ${input.model}. No fallback used.`);}
  const payload=await response.json() as Payload, candidate=payload.candidates?.[0],parts=candidate?.content?.parts;
  const usage=payload.usageMetadata;
  const known=[usage?.promptTokenCount,usage?.candidatesTokenCount,usage?.thoughtsTokenCount??0].every(n=>typeof n==="number"&&Number.isFinite(n)&&n>=0);
  let cost=0;
  if(input.approach==="image") {const m=MAP_MODELS.find(m=>m.id===input.model)!;cost=m.imageUsd+(known?(usage!.promptTokenCount!*m.inputPerMillion+(usage?.thoughtsTokenCount??0)*m.textPerMillion)/1e6:0);}
  else {const m=VISION_MODELS.find(m=>m.id===input.model)!;cost=known?(usage!.promptTokenCount!*m.inputPerMillion+(usage!.candidatesTokenCount!+(usage?.thoughtsTokenCount??0))*m.outputPerMillion)/1e6:16384*m.outputPerMillion/1e6;}
  const base={approach:input.approach,model:input.model,width:source.width,height:source.height,estimatedCostUsd:cost,costBasis:known?"usage" as const:"output-only" as const};
  if(input.approach==="vision") {
    if(candidate?.finishReason!=="STOP") throw new MapProviderError("Vision output was incomplete. Try another model.");
    try {const text=parts?.filter(p=>!p.thought).map(p=>p.text??"").join("");const parsed=JSON.parse(text??"") as {regions?:unknown};return {...base,regions:parseRegions(parsed.regions)};}catch(error){throw new MapProviderError(`Vision returned invalid polygons (${error instanceof TypeError?error.message:"invalid JSON"}).`);}
  }
  const image=parts?.find(p=>p.inlineData)?.inlineData;
  if(!image || !["image/png","image/jpeg","image/webp"].includes(image.mimeType) || image.data.length>8_000_000) throw new MapProviderError("Vertex returned no supported colour mask.");
  try {
    const bytes=Buffer.from(image.data,"base64"),meta=await sharp(bytes,{limitInputPixels:2048*2048}).metadata();
    if(meta.width===undefined || meta.height===undefined || Math.abs(meta.width/meta.height-source.width/source.height)>.04) throw new Error("aspect");
    const mask=await sharp(bytes).resize(source.width,source.height,{fit:"fill",kernel:"nearest"}).removeAlpha().png().toBuffer();
    return {...base,mask:`data:image/png;base64,${mask.toString("base64")}`,outputWidth:meta.width,outputHeight:meta.height};
  }catch{throw new MapProviderError("Mask dimensions/aspect ratio do not match the source.");}
}
export function createMaskGenerator(provider=callMaskVertex,load=sourceBytes,now=Date.now) {
  const cache=new Map<string,MaskResult>(),pending=new Map<string,Promise<MaskResult>>();
  let reservations:{time:number;usd:number}[]=[];
  const budget=()=>{reservations=reservations.filter(r=>r.time>now()-3_600_000);return {calls:reservations.length,callLimit:16,reservedUsd:reservations.reduce((s,r)=>s+r.usd,0),limitUsd:1,resetsAt:(reservations[0]?.time??now())+3_600_000};};
  async function generate(input:MaskInput) {
    const started=now(),source=await load(input),key=createHash("sha256").update(source.bytes).update(JSON.stringify([input.approach,input.model,IMAGE_INSTRUCTION,VISION_INSTRUCTION])).digest("hex");
    const wrap=(result:MaskResult,cached:boolean)=>({result,cached,requestCostUsd:cached?0:result.estimatedCostUsd,durationMs:now()-started,budget:budget()});
    const hit=cache.get(key);if(hit)return wrap(hit,true);
    const active=pending.get(key);if(active)return wrap(await active,true);
    const b=budget(),usd=maskReservation(input);
    if(b.calls>=b.callLimit || b.reservedUsd+usd>b.limitUsd)throw new MapLimitError("Hourly mask reservation budget exhausted. Reuse saved masks or wait.");
    reservations.push({time:now(),usd});
    const work=(async()=>{const output=await provider(input,source);const result={...output,durationMs:now()-started,generatedAt:new Date(now()).toISOString()};if(cache.size>=8)cache.delete(cache.keys().next().value!);cache.set(key,result);return result;})().finally(()=>pending.delete(key));
    pending.set(key,work);return wrap(await work,false);
  }
  return {generate,budget};
}
const state=globalThis as typeof globalThis & {g3bGenerator?:ReturnType<typeof createMaskGenerator>};
export const maskGenerator=state.g3bGenerator??=createMaskGenerator();
