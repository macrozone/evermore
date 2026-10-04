import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { getRequestHeaders, readMoodboardImage } = vi.hoisted(() => ({ getRequestHeaders: vi.fn(), readMoodboardImage: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("google-auth-library", () => ({ GoogleAuth: class { getRequestHeaders = getRequestHeaders; } }));
vi.mock("../../../../lib/moodboards", () => ({ readMoodboardImage }));
import { callMaskVertex, createMaskGenerator, sourceBytes, MapLimitError, MapProviderError } from "./generate";
import { GET, POST } from "./route";
import { parseMaskInput, maskReservation, VISION_INSTRUCTION } from "../../../lab/g3b-map/generation";

const input = parseMaskInput({source:"cabin",approach:"vision"});
const bytes = await sharp({create:{width:32,height:32,channels:4,background:"white"}}).png().toBuffer();
const source = {bytes,width:32,height:32};
const regions = [{label:"wall",kind:"collision",polygon:[[100,100],[400,100],[400,400],[100,400]]}];
const fetchMock = vi.fn();
const payload = (parts:unknown[] = [{text:JSON.stringify({regions})}], finishReason = "STOP") => new Response(JSON.stringify({candidates:[{finishReason,content:{parts}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:200,thoughtsTokenCount:10}}));
const request = (body:unknown = input, headers:Record<string,string> = {origin:"http://localhost:3000"}) => new Request("http://localhost:3000/api/lab/g3b-map",{method:"POST",headers,body:JSON.stringify(body)});
const provider = vi.fn(async () => ({approach:input.approach,model:input.model,width:32,height:32,regions:regions as NonNullable<Awaited<ReturnType<typeof callMaskVertex>>["regions"]>,estimatedCostUsd:.00034,costBasis:"usage" as const}));
beforeEach(()=>{
  vi.stubEnv("NODE_ENV","development");vi.stubEnv("GOOGLE_CLOUD_PROJECT","maw-evermore");vi.stubGlobal("fetch",fetchMock);
  getRequestHeaders.mockResolvedValue(new Headers({Authorization:"Bearer private-token"}));
  readMoodboardImage.mockResolvedValue(bytes);fetchMock.mockImplementation(async()=>payload());
});
afterEach(()=>{vi.clearAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs();});

describe("mask provider and source registration",()=>{
  it("passes the unchanged source to Vision and parses bounded object polygons",async()=>{
    const result=await callMaskVertex(input,source);
    expect(result).toMatchObject({regions,width:32,height:32,costBasis:"usage"});
    expect(result.estimatedCostUsd).toBeCloseTo((100*.30+210*2.5)/1e6);
    const [url,options]=fetchMock.mock.calls[0]!;
    expect(url).toContain(input.model);
    const body=JSON.parse(options.body);
    expect(body.contents[0].parts[0].text).toBe(VISION_INSTRUCTION);
    expect(body.contents[0].parts[1].inlineData.data).toBe(bytes.toString("base64"));
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.maxOutputTokens).toBe(16384);
    expect(body.generationConfig.responseSchema.properties.regions.items.properties.kind.enum).toEqual(["collision","overhead","free"]);
    expect(body.generationConfig.responseSchema.properties.regions.items.properties.polygon.items.items).toMatchObject({minimum:0,maximum:1000});
    expect(body.generationConfig.thinkingConfig).toEqual({thinkingLevel:"MINIMAL"});
    expect(JSON.stringify(result)).not.toContain("private-token");
  });
  it("registers colour-mask pixels to source dimensions and records the original output size",async()=>{
    const image=await sharp({create:{width:64,height:64,channels:3,background:"#ff0000"}}).png().toBuffer();
    fetchMock.mockResolvedValue(payload([{inlineData:{mimeType:"image/png",data:image.toString("base64")}}]));
    const result=await callMaskVertex(parseMaskInput({source:"cabin",approach:"image"}),source);
    expect(result).toMatchObject({width:32,height:32,outputWidth:64,outputHeight:64});
    const metadata=await sharp(Buffer.from(result.mask!.split(",")[1]!,"base64")).metadata();
    expect(metadata).toMatchObject({width:32,height:32});
  });
  it.each(["incomplete","invalid-json","invalid-regions","HTTP","network","ADC"])("rejects %s without silently using another model",async failure=>{
    if(failure==="incomplete")fetchMock.mockResolvedValue(payload(undefined,"MAX_TOKENS"));
    if(failure==="invalid-json")fetchMock.mockResolvedValue(payload([{text:"private malformed output"}]));
    if(failure==="invalid-regions")fetchMock.mockResolvedValue(payload([{text:'{"regions":[{"label":"wall","kind":"collision","polygon":[[-1,0],[1,0],[1,1]]}]}'}]));
    if(failure==="HTTP")fetchMock.mockResolvedValue(new Response("private provider error",{status:503}));
    if(failure==="network")fetchMock.mockRejectedValue(new Error("private network error"));
    if(failure==="ADC")getRequestHeaders.mockRejectedValue(new Error("private ADC error"));
    await expect(callMaskVertex(input,source)).rejects.toBeInstanceOf(MapProviderError);
    try{await callMaskVertex(input,source);}catch(error){expect(String(error)).not.toContain("private");}
  });
  it("rejects aspect-ratio changes rather than stretching a shifted mask",async()=>{
    const image=await sharp({create:{width:64,height:32,channels:3,background:"white"}}).png().toBuffer();
    fetchMock.mockResolvedValue(payload([{inlineData:{mimeType:"image/png",data:image.toString("base64")}}]));
    await expect(callMaskVertex(parseMaskInput({source:"cabin",approach:"image"}),source)).rejects.toThrow(/dimensions/);
  });
  it("loads fixed sources or bounded inline images without fetching arbitrary URLs",async()=>{
    expect(await sourceBytes(input)).toMatchObject({width:32,height:32});
    expect(readMoodboardImage).toHaveBeenCalledWith("02-eigene-welt","it2-waldhuette-abend.jpg");
    expect(await sourceBytes(parseMaskInput({source:"live",approach:"vision",image:`data:image/png;base64,${bytes.toString("base64")}`}))).toMatchObject({width:32,height:32});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("mask reservations and API boundary",()=>{
  it("deduplicates concurrent calls and keys the cache by source bytes and approach",async()=>{
    let release!:()=>void;const barrier=new Promise<void>(resolve=>{release=resolve;});
    const slow=vi.fn(async()=>{await barrier;return provider();});
    const load=vi.fn(async()=>source),service=createMaskGenerator(slow,load);
    const first=service.generate(input),second=service.generate(input);
    release();const [a,b]=await Promise.all([first,second]);
    expect(slow).toHaveBeenCalledTimes(1);expect(b).toMatchObject({cached:true,requestCostUsd:0,result:a.result});
    await service.generate({...input,approach:"image",model:"gemini-3.1-flash-lite-image"});
    load.mockResolvedValue({...source,bytes:Buffer.concat([bytes,Buffer.from("new source")])});
    await service.generate(input);expect(slow).toHaveBeenCalledTimes(3);
  });
  it("reserves before calling providers and keeps failed reservations until the hour expires",async()=>{
    let time=0;const service=createMaskGenerator(provider,async i=>({...source,bytes:Buffer.from(JSON.stringify(i))}),()=>time);
    const pro={...input,approach:"image" as const,model:"gemini-3.1-pro-image-preview"};
    // Use the actual supported Pro image model, shared with map generation.
    const {MAP_MODELS}=await import("../../../lab/g3b-map/generation");pro.model=MAP_MODELS[2].id;
    await service.generate(pro);
    await expect(service.generate({...pro,source:"live",image:"different"})).rejects.toBeInstanceOf(MapLimitError);
    expect(service.budget().reservedUsd).toBeCloseTo(maskReservation(pro));
    time=3_600_000;provider.mockRejectedValueOnce(new Error("failed request"));
    await expect(service.generate(input)).rejects.toThrow("failed request");expect(service.budget().calls).toBe(1);
    await service.generate(input);expect(service.budget().calls).toBe(2);
  });
  it.each(["production","test"])("rejects %s requests before ADC",async mode=>{vi.stubEnv("NODE_ENV",mode);expect((await POST(request())).status).toBe(403);expect(getRequestHeaders).not.toHaveBeenCalled();});
  it("rejects missing origins, forwarded requests and oversized request bodies",async()=>{
    expect((await POST(request(input,{}))).status).toBe(403);
    expect((await POST(request(input,{origin:"http://localhost:3000",forwarded:"host=localhost"}))).status).toBe(403);
    expect((await POST(new Request("http://localhost:3000/api/lab/g3b-map",{method:"POST",headers:{origin:"http://localhost:3000"},body:"x".repeat(8_010_001)}))).status).toBe(413);
    expect((await POST(request({source:"cabin",approach:"vision",model:"foreign"}))).status).toBe(400);
    expect(getRequestHeaders).not.toHaveBeenCalled();
  });
  it("returns a no-store budget and successful mask extraction",async()=>{
    const budget=await GET(new Request("http://localhost:3000/api/lab/g3b-map"));expect(budget.headers.get("cache-control")).toBe("no-store");
    const response=await POST(request());expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("no-store");expect(await response.json()).toMatchObject({result:{regions}});
  });
});
