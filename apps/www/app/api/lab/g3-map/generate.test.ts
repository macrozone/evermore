import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { getRequestHeaders } = vi.hoisted(() => ({ getRequestHeaders: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("google-auth-library", () => ({ GoogleAuth: class { getRequestHeaders = getRequestHeaders; } }));
import { callVertex, createMapGenerator, MapLimitError, MapProviderError, mapGenerator } from "./generate";
import { GET, POST } from "./route";
import { MAP_MODELS, MAP_STYLE, MAX_OUTPUT_TOKENS, parseMapInput, reservationUsd } from "../../../lab/g3-map/generation";

const input = parseMapInput({ prompt: "A forest cabin" });
const source = await sharp({ create: { width: 8, height: 8, channels: 4, background: "#709452" } }).png().toBuffer();
const provider = () => Promise.resolve({ bytes: source, cost: .034, costBasis: "image-only" as const });
const fetchMock = vi.fn();
const payload = () => new Response(JSON.stringify({
  candidates: [{ content: { parts: [{ inlineData: { data: source.toString("base64"), mimeType: "image/png" } }] } }],
  usageMetadata: { promptTokenCount: 100, thoughtsTokenCount: 20, candidatesTokensDetails: [{ modality: "IMAGE", tokenCount: 1120 }] },
}));
const request = (body: unknown = input, url = "http://localhost:3000/api/lab/g3-map", headers: Record<string, string> = { origin: "http://localhost:3000" }) => new Request(url, { method: "POST", headers, body: JSON.stringify(body) });
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "maw-evermore");
  vi.stubGlobal("fetch", fetchMock);
  getRequestHeaders.mockResolvedValue(new Headers({ Authorization: "Bearer private-token" }));
  fetchMock.mockImplementation(async () => payload());
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("local API boundary", () => {
  it.each(["production", "test"])("disables live calls in %s before ADC", async mode => {
    vi.stubEnv("NODE_ENV", mode);
    expect((await POST(request())).status).toBe(403);
    expect(getRequestHeaders).not.toHaveBeenCalled();
  });
  it.each([
    ["https://example.com/api/lab/g3-map", { origin: "https://example.com" }],
    ["http://localhost:3000/api/lab/g3-map", {}],
    ["http://localhost:3000/api/lab/g3-map", { origin: "http://evil.example" }],
    ["http://localhost:3000/api/lab/g3-map", { origin: "http://localhost:3000", host: "evil.example" }],
    ["http://localhost:3000/api/lab/g3-map", { origin: "http://localhost:3000", host: "localhost:3001" }],
    ["http://localhost:3000/api/lab/g3-map", { origin: "http://localhost:3000", "x-forwarded-host": "evil.example" }],
    ["http://localhost:3000/api/lab/g3-map", { origin: "http://localhost:3000", forwarded: "host=localhost" }],
    ["http://localhost:3000/api/lab/g3-map", { origin: "http://localhost:3000", "sec-fetch-site": "cross-site" }],
  ] as [string, Record<string, string>][])("rejects untrusted origins (%s)", async (url, headers) => {
    expect((await POST(request(input, url, headers))).status).toBe(403);
    expect(getRequestHeaders).not.toHaveBeenCalled();
  });
  it.each([null, [], {}, { prompt: " " }, { prompt: "x".repeat(501) }, { prompt: "map", model: "foreign/model" }, { prompt: "map", seed: -1 }, { prompt: "map", seed: 2147483648 }])("validates input before ADC", async value => {
    expect((await POST(request(value))).status).toBe(400);
    expect(getRequestHeaders).not.toHaveBeenCalled();
  });
  it("bounds input without relying on content-length", async () => {
    const response = await POST(new Request("http://localhost:3000/api/lab/g3-map", { method: "POST", headers: { origin: "http://localhost:3000" }, body: "x".repeat(8193) }));
    expect(response.status).toBe(413);
    expect(getRequestHeaders).not.toHaveBeenCalled();
  });
  it.each(["localhost", "127.0.0.1", "[::1]"])("reports a no-store budget on %s", async host => {
    const response = await GET(new Request(`http://${host}:3000/api/lab/g3-map`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ budget: { limitUsd: 1, callLimit: 20 } });
  });
  it("accepts Next-normalized loopback URLs and returns no-store images", async () => {
    const response = await POST(request(input, undefined, { host: "127.0.0.1:3000", "x-forwarded-host": "127.0.0.1:3000", origin: "http://127.0.0.1:3000" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ map: { width: 8, height: 8 } });
  });
});

describe("generation and reservations", () => {
  it("defaults to Flash-Lite and caps output", async () => {
    expect(input.model).toBe(MAP_MODELS[0].id);
    const result = await createMapGenerator().generate(input);
    expect(result.map.costBasis).toBe("usage");
    expect(result.map.estimatedCostUsd).toBeCloseTo(.0336 + .000025 + .00003);
    expect(JSON.stringify(result)).not.toContain("private-token");
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toContain(`locations/global/publishers/google/models/${input.model}:generateContent`);
    const body = JSON.parse(options.body);
    expect(body.contents[0].parts[0].text).toContain(MAP_STYLE);
    expect(body.generationConfig).toMatchObject({ seed: 1, maxOutputTokens: MAX_OUTPUT_TOKENS, imageConfig: { imageSize: "1K" } });
    expect(body.contents[0].parts).toHaveLength(1);
  });
  it("deduplicates in-flight settings, then serves free cache hits", async () => {
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const generate = vi.fn(async () => { await barrier; return provider(); });
    const service = createMapGenerator(generate);
    const first = service.generate(input), second = service.generate(input);
    expect(service.budget().calls).toBe(1);
    release();
    const [a, b] = await Promise.all([first, second]);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(b).toMatchObject({ cached: true, requestCostUsd: 0, map: a.map });
    expect((await service.generate(input)).requestCostUsd).toBe(0);
    await service.generate({ ...input, seed: 2 });
    await service.generate({ ...input, model: MAP_MODELS[1].id });
    expect(generate).toHaveBeenCalledTimes(3);
  });
  it("reserves the dollar limit atomically before slow providers and resets by time", async () => {
    let time = 0;
    const generate = vi.fn(provider), service = createMapGenerator(generate, () => time);
    const pro = { ...input, model: MAP_MODELS[2].id };
    const a = service.generate(pro), b = service.generate({ ...pro, seed: 2 });
    await expect(service.generate({ ...pro, seed: 3 })).rejects.toBeInstanceOf(MapLimitError);
    await Promise.all([a, b]);
    expect(service.budget().reservedUsd).toBeCloseTo(2 * reservationUsd(pro));
    expect(generate).toHaveBeenCalledTimes(2);
    expect((await service.generate(pro)).cached).toBe(true);
    time = 3_600_000;
    expect((await service.generate({ ...pro, seed: 3 })).budget.calls).toBe(1);
  });
  it("retains failed reservations and evicts bounded cached images", async () => {
    let time = 0;
    const generate = vi.fn(provider), service = createMapGenerator(generate, () => time);
    generate.mockRejectedValueOnce(new Error("private failure"));
    await expect(service.generate(input)).rejects.toThrow();
    expect(service.budget().calls).toBe(1);
    for (let seed = 0; seed < 9; seed++) { time += 3_600_001; await service.generate({ ...input, seed }); }
    await service.generate({ ...input, seed: 0 });
    expect(generate).toHaveBeenCalledTimes(11);
  });
  it.each(["auth", "HTTP", "network", "no-image", "invalid-image"])("sanitizes %s failures without model fallback", async failure => {
    if (failure === "auth") getRequestHeaders.mockRejectedValue(new Error("private ADC"));
    if (failure === "HTTP") fetchMock.mockResolvedValue(new Response("private error", { status: 404 }));
    if (failure === "network") fetchMock.mockRejectedValue(new Error("private network"));
    if (failure === "no-image") fetchMock.mockResolvedValue(new Response("{}"));
    if (failure === "invalid-image") fetchMock.mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: "bad", mimeType: "image/png" } }] } }] })));
    await expect(createMapGenerator().generate(input)).rejects.toBeInstanceOf(MapProviderError);
    try { await createMapGenerator().generate(input); } catch (error) { expect(String(error)).not.toContain("private"); }
  });
  it("bounds stalled ADC", async () => {
    vi.useFakeTimers();
    try {
      getRequestHeaders.mockReturnValue(new Promise(() => {}));
      const result = callVertex(input);
      const rejection = expect(result).rejects.toThrow("credentials");
      await vi.advanceTimersByTimeAsync(10_000);
      await rejection;
      expect(fetchMock).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it("labels incomplete usage as image-only instead of pretending it is a total", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: source.toString("base64"), mimeType: "image/png" } }] } }] })));
    expect(await callVertex(input)).toMatchObject({ cost: MAP_MODELS[0].imageUsd, costBasis: "image-only" });
  });
  it("returns 429 and retry time before auth while cache remains accessible", async () => {
    let seed = 100;
    while (mapGenerator.budget().reservedUsd + reservationUsd(input) <= 1) {
      expect((await POST(request({ ...input, seed: seed++ }))).status).toBe(200);
    }
    getRequestHeaders.mockClear();
    const response = await POST(request({ ...input, seed: 1000 }));
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(getRequestHeaders).not.toHaveBeenCalled();
    expect((await POST(request({ ...input, seed: seed - 1 }))).status).toBe(200);
  });
});
