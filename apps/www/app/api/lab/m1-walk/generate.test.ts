import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
const {imageProvider,maskProvider}=vi.hoisted(()=>({imageProvider:vi.fn(),maskProvider:vi.fn()}));
vi.mock("../g3-map/generate",()=>({callVertex:imageProvider,MapLimitError:class extends Error{},MapProviderError:class extends Error{}}));
vi.mock("../g3b-map/generate",()=>({callMaskVertex:maskProvider,sourceBytes:vi.fn()}));
import { createInteriorGenerator, interiorProvider, INTERIOR_MASK_INSTRUCTION, MapLimitError } from "./generate";
import { INTERIOR_INSTRUCTION, parseInteriorInput } from "../../../lab/m1-walk/generation";
import { POST } from "./route";
const bytes=await sharp({create:{width:64,height:64,channels:3,background:"white"}}).png().toBuffer();
const source={bytes,width:64,height:64},input=parseInteriorInput({});
const mask={approach:"vision" as const,model:input.maskModel,width:64,height:64,regions:[{label:"exit-door",kind:"free" as const,polygon:[[400,900],[600,900],[600,1000],[400,1000]] as [number,number][]}],estimatedCostUsd:.001,costBasis:"usage" as const,durationMs:1,generatedAt:"2026-10-04"};
const room={image:"data:image/png;base64,AA==",width:64,height:64,door:{x:32,y:60},model:input.model,durationMs:1,estimatedCostUsd:.034,generatedAt:"2026-10-04",mask};
afterEach(()=>{vi.clearAllMocks();vi.unstubAllEnvs();});
describe("interior pipeline",()=>{
  it("passes exterior bytes to image generation and resulting interior pixels to mask extraction",async()=>{
    imageProvider.mockResolvedValue({bytes,cost:.034});maskProvider.mockResolvedValue(mask);
    const result=await interiorProvider(input,source);
    expect(imageProvider.mock.calls[0]![1]).toEqual({bytes,instruction:INTERIOR_INSTRUCTION});
    expect(maskProvider.mock.calls[0]![1].bytes).toEqual(bytes);
    expect(maskProvider.mock.calls[0]![2]).toBe(INTERIOR_MASK_INSTRUCTION);
    expect(result.door).toEqual({x:32,y:60.8});
    maskProvider.mockResolvedValue({...mask,regions:[]});
    await expect(interiorProvider(input,source)).rejects.toThrow(/exit/);
  });
  it("deduplicates concurrent requests and reuses exactly the same complete room on re-entry",async()=>{
    let release!:()=>void;const barrier=new Promise<void>(r=>{release=r;});
    const provider=vi.fn(async()=>{await barrier;return room;});
    const service=createInteriorGenerator(provider,async()=>source);
    const a=service.generate(input),b=service.generate(input);release();
    const [first,second]=await Promise.all([a,b]);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(second).toMatchObject({room:first.room,cached:true,requestCostUsd:0});
    expect((await service.generate(input)).room).toBe(first.room);
    await service.generate({...input,maskModel:"gemini-3.8-flash"});expect(provider).toHaveBeenCalledTimes(2);
  });
  it("keeps failed reservations, releases pending state, and expires its budget after an hour",async()=>{
    let time=0;const provider=vi.fn(async()=>{throw new Error("model failure");});
    const service=createInteriorGenerator(provider,async()=>source,()=>time);
    for(let n=0;n<6;n++)await expect(service.generate(input)).rejects.toThrow("model failure");
    await expect(service.generate(input)).rejects.toBeInstanceOf(MapLimitError);
    expect(provider).toHaveBeenCalledTimes(6);
    time=3_600_000;await expect(service.generate(input)).rejects.toThrow("model failure");
    expect(service.budget().calls).toBe(1);
  });
  it("rejects production, foreign origins, unsupported models and oversized bodies before providers",async()=>{
    const request=(body='{}',origin='http://localhost:5600')=>new Request('http://localhost:5600/api/lab/m1-walk',{method:'POST',headers:{origin},body});
    vi.stubEnv("NODE_ENV","production");expect((await POST(request())).status).toBe(403);
    vi.stubEnv("NODE_ENV","development");expect((await POST(request('{}','https://foreign.test'))).status).toBe(403);
    expect((await POST(request('{"model":"foreign"}'))).status).toBe(400);
    expect((await POST(request('x'.repeat(2049)))).status).toBe(413);
    expect(imageProvider).not.toHaveBeenCalled();
  });
});
