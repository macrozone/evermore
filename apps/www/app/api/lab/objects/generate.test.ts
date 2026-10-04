import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { getRequestHeaders } = vi.hoisted(() => ({ getRequestHeaders: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("google-auth-library", () => ({ GoogleAuth: class { getRequestHeaders = getRequestHeaders; } }));
import { createObjectGenerator, objectGenerator, ObjectLimitError, ObjectProviderError } from "./generate";
import { GET, POST } from "./route";
import { estimateObject, parseObjectInput } from "../../../lab/objects/generation";
import { OBJECT_STYLE, prepareObjectSprite } from "../../../../lib/object-assets.mjs";
const input = parseObjectInput({ prompt: "A mossy well" });
const source = await sharp({ create: { width: 6, height: 6, channels: 4, background: "#ff00ff" } })
  .composite([{ input: Buffer.from([30, 180, 70, 255]), raw: { width: 1, height: 1, channels: 4 }, left: 2, top: 2 }]).png().toBuffer();
const provider = () => Promise.resolve({ bytes: source, mime: "image/png", cost: 0.04 });
const fetchMock = vi.fn();
const payload = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: source.toString("base64"), mimeType: "image/png" } }] } }], usageMetadata: { promptTokenCount: 1000 } }));
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubGlobal("fetch", fetchMock);
  getRequestHeaders.mockResolvedValue(new Headers({ Authorization: "Bearer secret-token" }));
  fetchMock.mockImplementation(async () => payload());
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const request = (body: unknown = input, url = "http://localhost:3000/api/lab/objects", headers: Record<string, string> = { origin: "http://localhost:3000" }) => new Request(url, { method: "POST", headers, body: JSON.stringify(body) });

describe("local generation protection and input", () => {
  it.each(["production", "test"])("disables the route in %s before auth", async mode => {
    vi.stubEnv("NODE_ENV", mode);
    expect((await POST(request())).status).toBe(403);
    expect((await GET(new Request("http://localhost:3000/api/lab/objects"))).status).toBe(403);
    expect(getRequestHeaders).not.toHaveBeenCalled();
  });
  it.each([
    ["https://example.com/api/lab/objects", { origin: "https://example.com" }],
    ["http://localhost:3000/api/lab/objects", {}],
    ["http://localhost:3000/api/lab/objects", { origin: "http://evil.example" }],
    ["http://localhost:3000/api/lab/objects", { origin: "http://localhost:3000", host: "evil.example" }],
    ["http://localhost:3000/api/lab/objects", { origin: "http://localhost:3000", "x-forwarded-host": "evil.example" }],
    ["http://localhost:3000/api/lab/objects", { origin: "http://localhost:3000", "sec-fetch-site": "cross-site" }],
  ] as [string, Record<string, string>][])("rejects foreign or missing origins (%s)", async (url, headers) => {
    expect((await POST(request(input, url, headers))).status).toBe(403);
    expect(getRequestHeaders).not.toHaveBeenCalled();
  });
  it.each([null, [], {}, { prompt: " " }, { prompt: "a".repeat(501) }, { prompt: "well", model: "arbitrary/model" },
    { prompt: "well", variants: 5 }, { prompt: "well", seed: -1 }, { prompt: "well", widthTiles: 3 },
    { prompt: "well", widthTiles: 9, heightTiles: 1 }, { prompt: "well", pixelSize: 0 }, { prompt: "well", kind: ["building"] },
    { prompt: "well", palette: "unknown" }])("rejects invalid settings before auth", async body => {
    expect((await POST(request(body))).status).toBe(400);
    expect(getRequestHeaders).not.toHaveBeenCalled();
  });
  it("bounds streamed input without content-length", async () => {
    expect((await POST(new Request("http://localhost:3000/api/lab/objects", { method: "POST", headers: { origin: "http://localhost:3000" }, body: "x".repeat(8193) }))).status).toBe(413);
    expect(getRequestHeaders).not.toHaveBeenCalled();
  });
  it("accepts Next-normalized localhost URLs with matching browser loopback headers", async () => {
    const response = await POST(request({ ...input, seed: 77 }, "http://localhost:3000/api/lab/objects", { host: "127.0.0.1:3000", "x-forwarded-host": "127.0.0.1:3000", origin: "http://127.0.0.1:3000" }));
    expect(response.status).toBe(200);
    expect((await response.json()).objects).toHaveLength(2);
  });
  it.each(["localhost", "127.0.0.1", "[::1]"])("reports the shared call budget on %s", async host => {
    const response = await GET(new Request(`http://${host}:3000/api/lab/objects`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ rate: { limit: 20 } });
  });
});

describe("generation budget, cache and errors", () => {
  it("reuses complete settings and only pays for new variants", async () => {
    const generate = vi.fn(provider);
    const service = createObjectGenerator(generate);
    const first = await service.generate(input);
    expect(first.objects).toHaveLength(2);
    const cached = await service.generate(parseObjectInput({ prompt: "  A mossy well  " }));
    expect(cached).toMatchObject({ cached: true, estimatedCostUsd: 0, objects: first.objects, rate: { used: 2 } });
    const extended = await service.generate({ ...input, variants: 4 });
    expect(extended.objects).toHaveLength(4);
    expect(extended.estimatedCostUsd).toBeCloseTo(0.08);
    await service.generate({ ...input, pixelSize: 2 });
    await service.generate({ ...input, palette: "hearth" });
    await service.generate({ ...input, widthTiles: 1, heightTiles: 8 });
    await service.generate({ ...input, model: "gemini-3-pro-image" });
    await service.generate({ ...input, kind: "building" });
    expect(generate).toHaveBeenCalledTimes(14);
  });
  it("deduplicates concurrent variants", async () => {
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const generate = vi.fn(async () => { await barrier; return provider(); });
    const service = createObjectGenerator(generate);
    const a = service.generate(input), b = service.generate(input);
    expect(service.rate().used).toBe(2);
    release();
    const [first, second] = await Promise.all([a, b]);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(second).toMatchObject({ cached: true, estimatedCostUsd: 0, objects: first.objects });
  });
  it("reserves the hourly budget atomically, preserves cache at the limit and resets the rolling window", async () => {
    let time = 0;
    const service = createObjectGenerator(provider, () => time);
    for (let seed = 0; seed < 20; seed += 4) await service.generate({ ...input, seed, variants: 4 });
    expect(service.rate().used).toBe(20);
    expect((await service.generate({ ...input, seed: 0 })).cached).toBe(true);
    await expect(service.generate({ ...input, seed: 100 })).rejects.toBeInstanceOf(ObjectLimitError);
    time = 3_600_000;
    expect((await service.generate({ ...input, seed: 100 })).rate.used).toBe(2);
  });
  it("retains successful variants, reports errors and retries failed variants without exposing secrets", async () => {
    const generate = vi.fn().mockResolvedValueOnce(await provider()).mockRejectedValueOnce(new Error("secret-token"));
    const service = createObjectGenerator(generate);
    const first = await service.generate(input);
    expect(first.objects).toHaveLength(1);
    expect(first.errors).toHaveLength(1);
    expect(JSON.stringify(first)).not.toContain("secret-token");
    generate.mockResolvedValue(await provider());
    expect((await service.generate(input)).objects).toHaveLength(2);
    expect(generate).toHaveBeenCalledTimes(3);
  });
  it("evicts old cache entries without losing the hourly budget", async () => {
    let time = 0;
    const generate = vi.fn(provider);
    const service = createObjectGenerator(generate, () => time);
    for (let i = 0; i < 9; i++) { time += 3_600_001; await service.generate({ ...input, seed: i * 4, variants: 4 }); }
    await service.generate(input);
    expect(generate).toHaveBeenCalledTimes(38);
  });
  it.each(["parallel", "second variant first"])("uses the selected Vertex model, shared library prompt and seeds with server-only auth (%s)", async order => {
    if (order === "second variant first") {
      let release!: () => void;
      // Hold the first variant's credentials until the second reaches fetch.
      getRequestHeaders.mockImplementationOnce(() => new Promise<Headers>(resolve => {
        release = () => resolve(new Headers({ Authorization: "Bearer secret-token" }));
      }));
      fetchMock.mockImplementationOnce(async () => { release(); return payload(); });
    }
    const result = await createObjectGenerator().generate({ ...input, model: "gemini-3.1-flash-image", seed: 42 });
    expect(result.objects).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain("secret-token");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const seeds = fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body).generationConfig.seed);
    if (order === "second variant first") expect(seeds).toEqual([43, 42]);
    expect([...seeds].sort((a, b) => a - b)).toEqual([42, 43]);
    const reference = await readFile("public/objects/source/well.png");
    for (const [url, options] of fetchMock.mock.calls) {
      expect(url).toContain("locations/global/publishers/google/models/gemini-3.1-flash-image:generateContent");
      expect(options.headers.get("authorization")).toBe("Bearer secret-token");
      const body = JSON.parse(options.body);
      expect(body.contents[0].parts[1].text).toContain(OBJECT_STYLE);
      expect(body.contents[0].parts[0].inlineData.mimeType).toBe("image/png");
      expect(Buffer.from(body.contents[0].parts[0].inlineData.data, "base64")).toEqual(reference);
      const object = result.objects.find(object => object.seed === body.generationConfig.seed);
      expect(object).toBeDefined();
      expect(object!.estimatedCostUsd).toBeCloseTo(0.0677);
    }
  });
  it.each(["auth", "HTTP", "network", "no-image", "invalid-image"])("shows %s errors without changing models or leaking provider data", async failure => {
    if (failure === "auth") getRequestHeaders.mockRejectedValue(new Error("private ADC path"));
    if (failure === "HTTP") fetchMock.mockImplementation(async () => new Response("secret-token", { status: 404 }));
    if (failure === "network") fetchMock.mockRejectedValue(new Error("secret-token"));
    if (failure === "no-image") fetchMock.mockImplementation(async () => new Response("{}"));
    if (failure === "invalid-image") fetchMock.mockImplementation(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: "invalid", mimeType: "image/png" } }] } }] })));
    const result = await createObjectGenerator().generate(input);
    expect(result.objects).toHaveLength(0); expect(result.errors).toHaveLength(2);
    expect(JSON.stringify(result)).not.toMatch(/secret-token|private ADC/);
    if (failure !== "auth") expect(fetchMock.mock.calls.every(call => String(call[0]).includes(input.model))).toBe(true);
  });
  it("bounds stalled ADC lookup", async () => {
    vi.useFakeTimers();
    try {
      getRequestHeaders.mockReturnValue(new Promise(() => {}));
      const result = createObjectGenerator().generate(input);
      await vi.advanceTimersByTimeAsync(10_000);
      expect((await result).errors).toHaveLength(2);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it("returns no-store successful generated variants from the API", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).objects).toHaveLength(2);
  });
});

describe("sprite preparation and footprints", () => {
  it("removes magenta, crops, preserves alpha, palette-maps and normalizes with nearest pixels deterministically", async () => {
    const sprite = await prepareObjectSprite(source, 16, 32, 4, ["#00ff00"]);
    expect(await prepareObjectSprite(source, 16, 32, 4, ["#00ff00"])).toEqual(sprite);
    const { data, info } = await sharp(sprite).raw().toBuffer({ resolveWithObject: true });
    expect(info).toMatchObject({ width: 16, height: 32, channels: 4 });
    let transparent = 0, opaque = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) transparent++;
      else { opaque++; expect([...data.subarray(i, i + 3)]).toEqual([0, 255, 0]); }
    }
    expect(transparent).toBeGreaterThan(0); expect(opaque).toBeGreaterThan(0);
  });
  it("rejects empty cutouts and unreadable images", async () => {
    const empty = await sharp({ create: { width: 2, height: 2, channels: 4, background: "#ff00ff" } }).png().toBuffer();
    await expect(prepareObjectSprite(empty, 16, 16)).rejects.toThrow("Empty cutout");
    await expect(prepareObjectSprite(Buffer.from("invalid"), 16, 16)).rejects.toThrow();
  });
  it("keeps the original offline library preparation byte-identical", async () => {
    for (const [id, width, height] of [["cottage", 64, 64], ["tree", 48, 64], ["well", 32, 48]] as const) {
      const raw = await readFile(`public/objects/source/${id}.png`);
      const expected = await readFile(`public/objects/${id}.png`);
      const prepared = await prepareObjectSprite(raw, width, height);
      const pixels = (image: Buffer) => sharp(image).raw().toBuffer();
      expect(await pixels(prepared)).toEqual(await pixels(expected));
    }
  });
  it.each(["vegetation", "decoration", "building"] as const)("estimates valid occupied and collision cells for extreme %s sizes", kind => {
    for (const widthTiles of [1, 8]) for (const heightTiles of [1, 8]) {
      const object = estimateObject({ ...input, kind, widthTiles, heightTiles });
      expect(object.width).toBe(widthTiles * 16); expect(object.height).toBe(heightTiles * 16);
      for (const [x, y] of object.footprint.collision) {
        expect(x).toBeLessThan(widthTiles); expect(y).toBeLessThan(heightTiles);
        expect(object.footprint.occupied).toContainEqual([x, y]);
      }
    }
  });
  it("never trusts generic errors from a custom provider", async () => {
    const result = await createObjectGenerator(async () => { throw new ObjectProviderError("Model unavailable; no fallback."); }).generate(input);
    expect(result.errors[0]!.error).toContain("no fallback");
  });
});

it("returns 429 with a retry time at the API boundary while still serving cache hits", async () => {
  let seed = 500;
  while (objectGenerator.rate().used < 20) {
    expect((await POST(request({ ...input, seed }))).status).toBe(200);
    seed += 2;
  }
  getRequestHeaders.mockClear();
  const response = await POST(request({ ...input, seed: 1000 }));
  expect(response.status).toBe(429);
  expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
  expect(await response.json()).toMatchObject({ rate: { used: 20, limit: 20 } });
  expect(getRequestHeaders).not.toHaveBeenCalled();
  expect((await POST(request(input))).status).toBe(200);
});
