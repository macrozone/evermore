import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { getRequestHeaders } = vi.hoisted(() => ({ getRequestHeaders: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("google-auth-library", () => ({ GoogleAuth: class { getRequestHeaders = getRequestHeaders; } }));
import { createAssetGenerator, generateImage, inferRole, AssetLimitError } from "./generate";
import { GET, POST } from "./route";
import { parseAssetInput, type AssetRole, type RoleInference, type AssetInput } from "../../../lab/asset-generator/generation";
import { encodeAsset, prepareAsset, repairFamilyEdges, seamError, proceduralVariant } from "./prepare";
const role: AssetRole = { role: "surface", widthTiles: 2, heightTiles: 2, anchorX: 0.5, anchorY: 1, explanation: "Ground repeats in both axes." };
const inference: RoleInference = { parameters: role, model: "gemini-3.5-flash-lite", durationMs: 12, estimatedCostUsd: 0.001, usage: { inputTokens: 20, outputTokens: 30 } };
const input = parseAssetInput({ action: "generate", description: "Cobblestones with grass in the joints", seed: 42 });
const source = await sharp({ create: { width: 12, height: 12, channels: 4, background: "#687842" } }).png().toBuffer();
const image = (_input?: AssetInput, _role?: AssetRole, _index?: number, _reference?: unknown) => Promise.resolve({ bytes: source, mime: "image/png", cost: 0.04 });
const infer = () => Promise.resolve(structuredClone(inference));
const fetchMock = vi.fn();
const request = (body: unknown = input, headers: Record<string, string> = { origin: "http://localhost:3000" }) => new Request("http://localhost:3000/api/lab/asset-generator", { method: "POST", headers, body: JSON.stringify(body) });
beforeEach(() => { vi.stubEnv("NODE_ENV", "development"); vi.stubGlobal("fetch", fetchMock); getRequestHeaders.mockResolvedValue(new Headers({ Authorization: "Bearer secret-token" })); });
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("roles, inputs and local protection", () => {
  it.each([null, {}, { ...input, description: " " }, { ...input, seed: 2147483638 }, { ...input, imageModel: "anything" }, { ...input, override: { ...role, widthTiles: 500 } }])("rejects invalid data before credentials", async value => {
    expect((await POST(request(value))).status).toBe(400); expect(getRequestHeaders).not.toHaveBeenCalled();
  });
  it.each(["production", "test"])("blocks paid calls in %s", async env => {
    vi.stubEnv("NODE_ENV", env); expect((await POST(request())).status).toBe(403); expect((await GET(new Request("http://localhost:3000/api/lab/asset-generator"))).status).toBe(403); expect(getRequestHeaders).not.toHaveBeenCalled();
  });
  it.each([{}, { origin: "https://evil.example" }, { origin: "http://localhost:3000", host: "evil.example" }, { origin: "http://localhost:3000", forwarded: "host=localhost" }] as Record<string, string>[])("rejects cross-origin requests", async headers => { expect((await POST(request(input, headers))).status).toBe(403); });
  it("bounds input streams and exposes a no-store budget", async () => {
    expect((await POST(new Request("http://localhost:3000/api/lab/asset-generator", { method: "POST", headers: { origin: "http://localhost:3000" }, body: "x".repeat(8193) }))).status).toBe(413);
    const response = await GET(new Request("http://localhost:3000/api/lab/asset-generator"));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("requests a Zod structured role without restricting subject vocabulary", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(role) }] } }], usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 30 } }), { headers: { "Content-Type": "application/json" } }));
    const result = await inferRole(input);
    expect(result.parameters).toEqual(role); expect(result.usage).toEqual({ inputTokens: 20, outputTokens: 30 });
    expect(JSON.stringify(result)).not.toContain("secret-token");
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.generationConfig.responseJsonSchema.properties.role).toBeDefined();
    expect(body.contents[0].parts[0].text).toContain(input.description);
  });
  it("uses the selected model, variant seed and fixed base reference", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: source.toString("base64"), mimeType: "image/png" } }] } }], usageMetadata: { promptTokenCount: 100, candidatesTokensDetails: [{ modality: "IMAGE", tokenCount: 1120 }] } })));
    const result = await generateImage(input, role, 9, await image());
    expect(result.cost).toBeCloseTo(0.033625);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toContain(input.imageModel); expect(options.headers.get("authorization")).toBe("Bearer secret-token");
    const body = JSON.parse(options.body);
    expect(body.generationConfig.seed).toBe(51); expect(body.contents[0].parts[1].inlineData.data).toBe(source.toString("base64"));
    expect(body.contents[0].parts[0].text).toContain("seamless repeat in both axes");
  });
});

describe("generation strategies and atomic limits", () => {
  it.each(["independent", "reference", "procedural"] as const)("produces ten %s variants and caches complete settings", async strategy => {
    const provider = vi.fn(image), text = vi.fn(infer), service = createAssetGenerator(text, provider);
    const first = await service.generate({ ...input, strategy });
    expect(first.variants).toHaveLength(10); expect(first.errors).toEqual([]);
    expect(provider).toHaveBeenCalledTimes(strategy === "procedural" ? 1 : 10);
    expect(first.estimatedCostUsd).toBeCloseTo(strategy === "procedural" ? 0.041 : 0.401);
    for (const v of first.variants) expect(v.seamError).toEqual({ horizontal: 0, vertical: 0 });
    if (strategy === "reference") { expect(provider.mock.calls[0]).toHaveLength(4); expect(provider.mock.calls[1]![3]).toBeDefined(); }
    const second = await service.generate({ ...input, strategy });
    expect(second).toMatchObject({ cached: true, estimatedCostUsd: 0, variants: first.variants }); expect(text).toHaveBeenCalledTimes(1);
    await service.generate({ ...input, strategy, override: { ...role, widthTiles: 3 } });
    expect(text).toHaveBeenCalledTimes(1);
  });
  it("deduplicates concurrent batches and reserves before inference", async () => {
    let release!: () => void; const gate = new Promise<void>(r => { release = r; });
    const text = vi.fn(async () => { await gate; return infer(); }), provider = vi.fn(image);
    const service = createAssetGenerator(text, provider);
    const a = service.generate(input), b = service.generate(input);
    expect(service.rate().imageUsed).toBe(10); release();
    const [first, second] = await Promise.all([a, b]);
    expect(provider).toHaveBeenCalledTimes(10); expect(second.estimatedCostUsd).toBe(0); expect(first.cached).toBe(false);
  });
  it("enforces the hourly cap while permitting cached requests and resets", async () => {
    let time = 1; const service = createAssetGenerator(infer, image, () => time);
    for (let seed = 0; seed < 100; seed += 10) await service.generate({ ...input, seed });
    await expect(service.generate({ ...input, seed: 900 })).rejects.toBeInstanceOf(AssetLimitError);
    expect((await service.generate({ ...input, seed: 0 })).cached).toBe(true);
    time += 3_600_001; expect((await service.generate({ ...input, seed: 900 })).variants).toHaveLength(10);
  });
  it("preserves successful variants and hides arbitrary provider errors", async () => {
    const provider = vi.fn(image).mockRejectedValueOnce(new Error("secret-token"));
    const result = await createAssetGenerator(infer, provider).generate(input);
    expect(result.variants).toHaveLength(9); expect(result.variants[0]!.index).toBe(1); expect(result.errors).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("secret-token"); expect(result.estimatedCostUsd).toBeCloseTo(0.361);
  });
});

describe("sprite cutouts and family seams", () => {
  it("keys only border-connected magenta, preserves purple interiors and enforces dimensions", async () => {
    const source = await sharp({ create: { width: 12, height: 12, channels: 4, background: "#ff00ff" } })
      .composite([{ input: await sharp({ create: { width: 6, height: 6, channels: 4, background: "#70426f" } }).png().toBuffer(), left: 3, top: 3 }]).png().toBuffer();
    const object = { ...role, role: "object" as const, widthTiles: 2, heightTiles: 3 };
    const pixels = await prepareAsset(source, object);
    expect(pixels.length).toBe(32 * 48 * 4); expect(pixels[3]).toBe(0);
    expect([...pixels.subarray((24 * 32 + 16) * 4, (24 * 32 + 16) * 4 + 4)]).toEqual([112, 66, 111, 255]);
    const png = await encodeAsset(pixels, 32, 48); expect((await sharp(png).metadata()).width).toBe(32);
  });
  it("removes reserved magenta in enclosed sprite cavities", async () => {
    const pixels = Buffer.alloc(12 * 12 * 4);
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
      const key = x < 2 || x > 9 || y < 2 || y > 9 || (x >= 4 && x <= 7 && y >= 4 && y <= 7);
      Buffer.from(key ? [255, 0, 255, 255] : [70, 100, 60, 255]).copy(pixels, (y * 12 + x) * 4);
    }
    const png = await encodeAsset(pixels, 12, 12);
    const out = await prepareAsset(png, { ...role, role: "object" });
    expect(out[(16 * 32 + 16) * 4 + 3]).toBe(0);
  });
  it("creates deterministic procedural changes while preserving alpha", async () => {
    const pixels = await prepareAsset(source, role);
    const a = proceduralVariant(pixels, 32, 32, 42, 1);
    expect(a).toEqual(proceduralVariant(pixels, 32, 32, 42, 1));
    expect(a).not.toEqual(proceduralVariant(pixels, 32, 32, 42, 2));
    for (let i = 3; i < a.length; i += 4) expect(a[i]).toBe(255);
  });
  it("rejects empty sprites and images without background instead of showing opaque squares", async () => {
    const object = { ...role, role: "object" as const };
    await expect(prepareAsset(source, object)).rejects.toThrow("No transparent");
    const blank = await sharp({ create: { width: 8, height: 8, channels: 4, background: "#ff00ff" } }).png().toBuffer();
    await expect(prepareAsset(blank, object)).rejects.toThrow("Empty cutout");
  });
  it("matches opposite and cross-variant edges even at band intersections", () => {
    const w = 16, h = 32;
    const raw = [Buffer.from(Array.from({ length: w * h * 4 }, (_, i) => i * 17 % 256)), Buffer.from(Array.from({ length: w * h * 4 }, (_, i) => i * 43 % 256))];
    const out = repairFamilyEdges(raw, w, h, "xy");
    for (const pixels of out) expect(seamError(pixels, w, h)).toEqual({ horizontal: 0, vertical: 0 });
    for (let y = 0; y < h; y++) expect(out[0]!.subarray(y * w * 4, y * w * 4 + 4)).toEqual(out[1]!.subarray((y * w + w - 1) * 4, (y * w + w - 1) * 4 + 4));
    expect(raw[0]).not.toEqual(out[0]);
  });
});
