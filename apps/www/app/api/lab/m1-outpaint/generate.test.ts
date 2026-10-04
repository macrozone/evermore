import sharp from "sharp";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const { getRequestHeaders } = vi.hoisted(() => ({ getRequestHeaders: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("google-auth-library", () => ({ GoogleAuth: class {
        getRequestHeaders = getRequestHeaders;
    } }));
import { prepareCanvas, cutOutput, callChunkVertex, createChunkGenerator, chunkGenerator, MapLimitError } from "./generate";
import { parseChunkInput } from "../../../lab/m1-outpaint/generation";
import { GET, POST } from "./route";
const source = await sharp({ create: { width: 128, height: 128, channels: 3, background: "#123456" } }).png().toBuffer();
const input = parseChunkInput({ image: `data:image/png;base64,${source.toString("base64")}`, direction: "east" });
const provider = vi.fn(async (i: typeof input, p: Awaited<ReturnType<typeof prepareCanvas>>) => ({ bytes: p.board, cost: .034 }));
const maskProvider = vi.fn(async () => ({ approach: "vision" as const, model: input.maskModel, width: 128, height: 128, estimatedCostUsd: .004, costBasis: "usage" as const, regions: [{ label: "tree crown", kind: "overhead" as const, polygon: [[100, 100], [200, 100], [200, 200]] as [
                number,
                number
            ][] }] }));
beforeEach(() => { vi.stubEnv("NODE_ENV", "development"); getRequestHeaders.mockResolvedValue(new Headers({ Authorization: "Bearer private" })); });
afterEach(() => { vi.restoreAllMocks();vi.clearAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("outpaint canvas and model boundary", () => {
    it.each(["north", "east", "south", "west"] as const)("places the %s strip at the matching edge and cuts a full neighbour", async (direction) => {
        const p = await prepareCanvas({ ...input, direction });
        const image = sharp(p.board).removeAlpha();
        const raw = await image.raw().toBuffer({ resolveWithObject: true });
        const point = direction === "east" ? [0, 0] : direction === "west" ? [128, 0] : direction === "north" ? [0, 128] : [0, 0];
        const index = (point[1]! * p.boardWidth + point[0]!) * 3;
        expect([...raw.data.subarray(index, index + 3)]).toEqual([0x12, 0x34, 0x56]);
        const cut = await cutOutput(p.board, p, direction);
        expect(await sharp(cut.image).metadata()).toMatchObject({ width: 128, height: 128 });
        expect(await sharp(cut.context).metadata()).toMatchObject({ width: p.horizontal ? 96 : 128, height: p.horizontal ? 128 : 96 });
        expect([...await sharp(cut.image).raw().toBuffer()].every(v => v === 128)).toBe(true);
    });
    it("rejects invalid images and incompatible output aspect ratios", async () => {
        await expect(prepareCanvas({ ...input, image: "data:image/png;base64,YQ==" })).rejects.toThrow(/valid image/);
        const p = await prepareCanvas(input), bad = await sharp({ create: { width: 128, height: 1024, channels: 3, background: "red" } }).png().toBuffer();
        await expect(cutOutput(bad, p, "east")).rejects.toThrow(/dimensions/);
    });
    it("passes the registered padded canvas, uses only the chosen model", async () => {
        const p = await prepareCanvas(input), fetchMock = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: p.board.toString("base64") } }] } }], usageMetadata: { promptTokenCount: 200 } })));
        vi.stubGlobal("fetch", fetchMock);
        const result = await callChunkVertex(input, p);
        expect(result.cost).toBeCloseTo(.03365);
        const [url, options] = fetchMock.mock.calls[0]! as unknown as [
            string,
            RequestInit
        ];
        expect(url).toContain(input.model);
        const body = JSON.parse(options.body as string);
        expect(body.contents[0].parts[0].text).toContain("Continue every path and river");
        expect(body.contents[0].parts[1].inlineData.data).toBe(p.board.toString("base64"));
        fetchMock.mockResolvedValue(new Response("private provider output", { status: 503 }));
        await expect(callChunkVertex(input, p)).rejects.toThrow(/HTTP 503/);
    });
});
describe("chunk caching, costs and reservations", () => {
    it("deduplicates and stores image plus masks as one successful chunk; failures remain retryable", async () => {
        const generator = createChunkGenerator(provider, maskProvider);
        const [a, b] = await Promise.all([generator.generate(input), generator.generate(input)]);
        expect(provider).toHaveBeenCalledTimes(1);
        expect(maskProvider).toHaveBeenCalledTimes(1);
        expect(a.chunk.estimatedCostUsd).toBeCloseTo(.038);
        expect([a,b].filter(result=>result.cached)).toHaveLength(1);
        expect(a.requestCostUsd+b.requestCostUsd).toBeCloseTo(.038);
        const maskSource = maskProvider.mock.calls[0]! as unknown as [
            {
                image: string;
            },
            {
                bytes: Buffer;
            }
        ];
        expect(maskSource[0].image).toBe(a.chunk.image);
        expect(maskSource[1].bytes.toString("base64")).toBe(a.chunk.image.split(",")[1]);
        maskProvider.mockRejectedValueOnce(new Error("mask failure"));
        await expect(generator.generate({ ...input, direction: "west" })).rejects.toThrow("mask failure");
        expect(generator.budget().calls).toBe(2);
        const retried = await generator.generate({ ...input, direction: "west" });
        expect(generator.budget().calls).toBe(3);
        expect(provider).toHaveBeenCalledTimes(2);
        expect(retried.requestCostUsd).toBeCloseTo(.004);
    });
    it("keys by direction/models/source and stops reservations before a provider call", async () => {
        let time = 0;
        const generator = createChunkGenerator(provider, maskProvider, () => time);
        for (let i = 0; i < 8; i++) {
            const different = await sharp({ create: { width: 128, height: 128, channels: 3, background: { r: i, g: 0, b: 0 } } }).png().toBuffer();
            await generator.generate({ ...input, image: `data:image/png;base64,${different.toString("base64")}` });
        }
        await expect(generator.generate(input)).rejects.toBeInstanceOf(MapLimitError);
        expect(provider).toHaveBeenCalledTimes(8);
        time = 3600000;
        await generator.generate({ ...input, direction: "north" });
        expect(generator.budget().calls).toBe(1);
    });
    it("preserves typed budget failures across development reloads without exposing unexpected errors",async()=>{
        const request=()=>new Request("http://localhost:3000/api/lab/m1-outpaint",{method:"POST",headers:{origin:"http://localhost:3000"},body:JSON.stringify(input)});
        const generate=vi.spyOn(chunkGenerator,"generate").mockRejectedValueOnce(Object.assign(new Error("Budget exhausted."),{code:"map_limit"}));
        const limited=await POST(request());expect(limited.status).toBe(429);expect(await limited.json()).toMatchObject({error:"Budget exhausted."});
        generate.mockRejectedValueOnce(new Error("private unexpected failure"));expect(await (await POST(request())).json()).toMatchObject({error:"Chunk generation failed."});
    });
    it("denies remote/production requests and bounds bodies before ADC", async () => {
        const request = (body: string, origin?: string) => new Request("http://localhost:3000/api/lab/m1-outpaint", { method: "POST", headers: origin !== undefined ? { origin } : {}, body });
        expect((await POST(request(JSON.stringify(input)))).status).toBe(403);
        expect((await POST(request("x".repeat(8010001), "http://localhost:3000"))).status).toBe(413);
        expect((await POST(request('{}', "http://localhost:3000"))).status).toBe(400);
        vi.stubEnv("NODE_ENV", "production");
        expect((await GET(new Request("http://localhost:3000/api/lab/m1-outpaint"))).status).toBe(403);
        expect(getRequestHeaders).not.toHaveBeenCalled();
    });
});
