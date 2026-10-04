import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRasterExample, WORLD_EXAMPLES } from "@evermore/world";

const { getRequestHeaders } = vi.hoisted(() => ({ getRequestHeaders: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("google-auth-library", () => ({ GoogleAuth: class { getRequestHeaders = getRequestHeaders; getClient = async () => ({ getAccessToken: async () => ({ token: "secret-token" }) }); } }));
import { generateBook } from "./generate";
import { parseBookInput } from "../../../lab/book/generation";
import { POST } from "./route";

const input = parseBookInput({ answers: ["A botanist beside a forest", "A cottage bedroom"] });
const fetchMock = vi.fn();
const sleep = { name: "Cottage bedroom", buildingIndex: 0, floor: 0 };
const gemini = (spec: unknown = { ...WORLD_EXAMPLES[0], sleepingPlace: sleep }, finishReason = "STOP") => new Response(JSON.stringify({
  candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(spec) }] } }],
  usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 450 },
}), { headers: { "Content-Type": "application/json" } });
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("BOOK_VERTEX_DISABLED", "false");
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "maw-evermore");
  vi.stubEnv("BOOK_VERTEX_LOCATION", "eu");
  getRequestHeaders.mockResolvedValue(new Headers({ Authorization: "Bearer secret-token" }));
  fetchMock.mockImplementation(async () => gemini());
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("book generation", () => {
  it("uses EU Vertex, structured output and both answers without exposing credentials", async () => {
    const result = await generateBook(input);
    expect(result).toMatchObject({ source: "vertex", specification: WORLD_EXAMPLES[0], usage: { inputTokens: 120, outputTokens: 450 } });
    expect(JSON.stringify(result)).not.toContain("secret-token");
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://aiplatform.eu.rep.googleapis.com/v1beta1/projects/maw-evermore/locations/eu/publishers/google/models/gemini-3.5-flash-lite:generateContent");
    expect(new Headers(options.headers).get("Authorization")).toBe("Bearer secret-token");
    const body = JSON.parse(options.body);
    expect(JSON.parse(body.contents[0].parts[0].text)).toEqual({ whoAndWhere: input.answers[0], sleepingPlace: input.answers[1] });
    expect(body.generationConfig.responseJsonSchema.properties.spawn).toBeDefined();
    expect(body.generationConfig.responseJsonSchema.required).toContain("sleepingPlace");
    expect(result.specification.sleepingPlace?.name).toBe("Cottage bedroom");
  });
  it("requests a missing sleeping place instead of silently ignoring the second answer", async () => {
    fetchMock.mockResolvedValueOnce(gemini(WORLD_EXAMPLES[0]));
    const result = await generateBook(input);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body).contents[0].parts[0].text).toContain("$.sleepingPlace");
    expect(result.source).toBe("vertex");
  });
  it("marks the fallback sleeping place as an example", async () => {
    vi.stubEnv("BOOK_VERTEX_DISABLED", "true");
    const result = await generateBook(input);
    expect(result.specification.sleepingPlace).toEqual({ name: "Example sleeping place", buildingIndex: 0, floor: 1 });
  });
  it("switches Gemini models and their thinking budget", async () => {
    await generateBook({ ...input, model: "gemini-3.8-flash" });
    expect(fetchMock.mock.calls[0]![0]).toContain("gemini-3.8-flash:generateContent");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).generationConfig.thinkingConfig.thinkingLevel).toBe("low");
  });
  it("uses Claude rawPredict and the SDK structured-output tool adapter", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({
      id: "msg_test", type: "message", role: "assistant", model: "claude-sonnet-5-5",
      stop_reason: "tool_use", stop_sequence: null,
      content: [{ type: "tool_use", id: "call_1", name: "json", input: { ...WORLD_EXAMPLES[1], sleepingPlace: sleep } }],
      usage: { input_tokens: 50, output_tokens: 100 },
    }), { headers: { "Content-Type": "application/json" } }));
    const result = await generateBook({ ...input, model: "claude-sonnet-5-5" });
    expect(result).toMatchObject({ source: "vertex", specification: WORLD_EXAMPLES[1], usage: { inputTokens: 50, outputTokens: 100 } });
    expect(fetchMock.mock.calls[0]![0]).toContain("publishers/anthropic/models/claude-sonnet-5-5:rawPredict");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).tools[0].input_schema.properties.spawn).toBeDefined();
  });
  it("returns repeatable themed examples without ADC", async () => {
    getRequestHeaders.mockRejectedValue(new Error("private credential file path"));
    const coastal = { ...input, answers: ["I live by the harbour", "Above the inn"] as [string, string] };
    const a = await generateBook(coastal);
    const b = await generateBook(coastal);
    expect(a).toMatchObject({ source: "example", fallbackReason: "credentials", specification: WORLD_EXAMPLES[1] });
    expect(a.seed).toBe(b.seed);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.stringify(a)).not.toContain("private credential");
  });
  it("can disable live calls for reproducible lab review", async () => {
    vi.stubEnv("BOOK_VERTEX_DISABLED", "true");
    expect(await generateBook(input)).toMatchObject({ source: "example", fallbackReason: "disabled" });
    expect(getRequestHeaders).not.toHaveBeenCalled();
  });
  it.each(["HTTP", "network"])("falls back on %s provider failure", async kind => {
    if (kind === "HTTP") fetchMock.mockResolvedValue(new Response("private provider message", { status: 403 }));
    else fetchMock.mockRejectedValue(new Error("private network message"));
    const result = await generateBook(input);
    expect(result.fallbackReason).toBe("provider");
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("repairs soft fields before retrying the model", async () => {
    fetchMock.mockImplementation(async () => gemini({ ...WORLD_EXAMPLES[0], sleepingPlace: sleep, palette: ["forestgreen", "brown"], spawn: { x: 100, y: -10 } }));
    const result = await generateBook(input);
    expect(result.source).toBe("vertex");
    expect(result.repairs?.length).toBeGreaterThan(0);
    expect(result.strategy).toBe("g1");
    expect(result.usage).toEqual({ inputTokens: 120, outputTokens: 450 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("retries once with a concrete path and rule for an unreparable response", async () => {
    fetchMock.mockResolvedValueOnce(gemini({ ...WORLD_EXAMPLES[0], sleepingPlace: sleep, biome: "invented" }));
    const result = await generateBook(input);
    expect(result.source).toBe("vertex");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(body.contents[0].parts[0].text).toContain("$.biome:");
    expect(body.contents[0].parts[0].text).toContain(input.answers[1]);
    expect(result.usage).toEqual({ inputTokens: 240, outputTokens: 900 });
  });
  it("falls back only after two invalid responses, exposing the failing path and rule", async () => {
    fetchMock.mockImplementation(async () => gemini({ ...WORLD_EXAMPLES[0], sleepingPlace: sleep, biome: "invented" }));
    const result = await generateBook(input);
    expect(result).toMatchObject({ source: "example", fallbackReason: "invalid-output", specification: WORLD_EXAMPLES[0] });
    expect(result.fallbackDetail).toContain("$.biome:");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("rejects truncated or safety-blocked output even if its JSON is valid", async () => {
    fetchMock.mockImplementation(async () => gemini(WORLD_EXAMPLES[0], "MAX_TOKENS"));
    expect((await generateBook(input)).fallbackDetail).toContain("$: Model response was incomplete");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("keeps at least nine of ten representative responses as interpreted worlds", async () => {
    const changes = [
      {}, { palette: ["forestgreen", "brown"] }, { palette: ["#abc", "unknown tone"] },
      { spawn: { x: 100, y: -1 } }, { spawn: { x: 24, y: 18 } },
      { size: { width: 64, depth: 64, height: 16 } },
      { landmarks: [{ name: "Named stone", x: 180, y: 200 }] },
      { settlement: { buildings: [{ name: "My sleeping place", x: 80, y: -20, width: 10, depth: 10, floors: 4 }] } },
      { settlement: { buildings: [{ name: "Home", x: 24, y: 18, width: 10, depth: 10, floors: 1 }, { name: "Workshop", x: 24, y: 18, width: 10, depth: 10, floors: 1 }] } },
      { biome: "unsupported" },
    ];
    let interpreted = 0;
    for (const [i, change] of changes.entries()) {
      fetchMock.mockImplementation(async () => gemini({ ...WORLD_EXAMPLES[0], sleepingPlace: sleep, name: `Answer world ${i}`, ...change }));
      const result = await generateBook({ ...input, answers: [`A botanist in home ${i}`, "A cottage bedroom"] });
      if (result.source === "vertex" && result.strategy === "g1") { interpreted++; expect(result.specification.name).toBe(`Answer world ${i}`); }
    }
    expect(interpreted).toBeGreaterThanOrEqual(9);
  });
  it("bounds stalled provider requests within the same twelve-second deadline", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockReturnValue(new Promise(() => {}));
      const result = generateBook(input);
      await vi.advanceTimersByTimeAsync(12_000);
      expect(await result).toMatchObject({ source: "example", fallbackReason: "provider" });
    } finally { vi.useRealTimers(); }
  });
  it("bounds stalled credential resolution", async () => {
    vi.useFakeTimers();
    try {
      getRequestHeaders.mockReturnValue(new Promise(() => {}));
      const result = generateBook(input);
      await vi.advanceTimersByTimeAsync(12_000);
      expect(await result).toMatchObject({ source: "example", fallbackReason: "credentials" });
    } finally { vi.useRealTimers(); }
  });
});

describe("G2 provider generation", () => {
  const rasterInput = parseBookInput({ answers: input.answers, strategy: "g2" });
  it("defaults to Flash MEDIUM and parses direct layers", async () => {
    const raster = createRasterExample();
    fetchMock.mockResolvedValue(gemini(raster));
    const result = await generateBook(rasterInput);
    expect(result).toMatchObject({ strategy: "g2", source: "vertex", raster, repairedRaster: raster, report: { changedCells: 0 } });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.generationConfig.thinkingConfig.thinkingLevel).toBe("medium");
    expect(body.generationConfig.maxOutputTokens).toBe(16384);
    expect(body.generationConfig.responseJsonSchema.properties.layers).toBeDefined();
  });
  it("repairs model cell inconsistencies and preserves the original for comparison", async () => {
    const raster = createRasterExample();
    raster.layers[1]![8] = raster.layers[1]![8]!.slice(0, 8) + "." + raster.layers[1]![8]!.slice(9);
    fetchMock.mockResolvedValue(gemini(raster));
    const result = await generateBook(rasterInput);
    expect(result).toMatchObject({ strategy: "g2", source: "vertex", raster, report: { wallRepairs: 1, changedCells: 1 } });
    if (result.strategy === "g2") expect(result.repairedRaster.layers[1]![8]![8]).toBe("#");
  });
  it("supports Claude direct raster output", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      id: "msg_raster", type: "message", role: "assistant", model: "claude-sonnet-5-5",
      stop_reason: "tool_use", stop_sequence: null,
      content: [{ type: "tool_use", id: "call_raster", name: "json", input: createRasterExample() }],
      usage: { input_tokens: 50, output_tokens: 100 },
    }), { headers: { "Content-Type": "application/json" } }));
    expect(await generateBook({ ...rasterInput, model: "claude-sonnet-5-5" })).toMatchObject({ strategy: "g2", source: "vertex" });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.max_tokens).toBe(8192);
    expect(body.tools[0].input_schema.properties.layers).toBeDefined();
  });
  it("rejects malformed grids with a labelled raster fallback and billed usage", async () => {
    const raster = createRasterExample(); raster.layers[0]![0] = "short";
    fetchMock.mockResolvedValue(gemini(raster));
    expect(await generateBook(rasterInput)).toMatchObject({ strategy: "g2", source: "example", fallbackReason: "invalid-output", report: { changedCells: 0 }, usage: { inputTokens: 120, outputTokens: 450 } });
  });
  it("keeps usage visible when thinking exhausts the output budget", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: '{"version":1' }] } }], usageMetadata: { promptTokenCount: 1503, candidatesTokenCount: 313, thoughtsTokenCount: 7865 } })));
    expect(await generateBook(rasterInput)).toMatchObject({ source: "example", fallbackReason: "invalid-output", usage: { inputTokens: 1503, outputTokens: 313, thinkingTokens: 7865 } });
  });
  it("reports thinking tokens and handles malformed provider envelopes safely", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(createRasterExample()) }] } }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200, thoughtsTokenCount: 300 } })));
    expect(await generateBook(rasterInput)).toMatchObject({ usage: { thinkingTokens: 300 } });
    fetchMock.mockResolvedValue(new Response("null"));
    expect(await generateBook(rasterInput)).toMatchObject({ source: "example", fallbackReason: "provider" });
  });
  it("bounds G2 credential resolution within its larger budget", async () => {
    vi.useFakeTimers();
    try {
      getRequestHeaders.mockReturnValue(new Promise(() => {}));
      const result = generateBook(rasterInput);
      await vi.advanceTimersByTimeAsync(90_000);
      expect(await result).toMatchObject({ source: "example", fallbackReason: "credentials" });
    } finally { vi.useRealTimers(); }
  });
  it("uses an offline raster when disabled", async () => {
    vi.stubEnv("BOOK_VERTEX_DISABLED", "true");
    expect(await generateBook(rasterInput)).toMatchObject({ strategy: "g2", source: "example", fallbackReason: "disabled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("book API input", () => {
  it.each([null, {}, { answers: ["", "bed"] }, { answers: ["  ", "bed"] }, { answers: ["a".repeat(4001), "bed"] }, { answers: ["forest", "bed", "extra"] }, { answers: ["forest", "bed"], model: "arbitrary/endpoint" }, { answers: ["forest", "bed"], strategy: "arbitrary" }])("rejects invalid input before auth", async body => {
    const response = await POST(new Request("http://localhost/api/lab/book", { method: "POST", body: JSON.stringify(body) }));
    expect(response.status).toBe(400);
    expect(getRequestHeaders).not.toHaveBeenCalled();
  });
  it("limits streamed bodies without a Content-Length header", async () => {
    const response = await POST(new Request("http://localhost/api/lab/book", { method: "POST", body: "a".repeat(40_001) }));
    expect(response.status).toBe(413);
    expect(getRequestHeaders).not.toHaveBeenCalled();
  });
  it("returns a validated result with no caching", async () => {
    const response = await POST(new Request("http://localhost/api/lab/book", { method: "POST", body: JSON.stringify(input) }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ source: "vertex", specification: WORLD_EXAMPLES[0] });
  });
});
