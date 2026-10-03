import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WORLD_EXAMPLES } from "@evermore/world";

const { getRequestHeaders } = vi.hoisted(() => ({ getRequestHeaders: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("google-auth-library", () => ({ GoogleAuth: class { getRequestHeaders = getRequestHeaders; } }));
import { generateBook } from "./generate";
import { parseBookInput } from "../../../lab/book/generation";
import { POST } from "./route";

const input = parseBookInput({ answers: ["A botanist beside a forest", "A cottage bedroom"] });
const fetchMock = vi.fn();
const gemini = (spec: unknown = WORLD_EXAMPLES[0]) => new Response(JSON.stringify({
  candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(spec) }] } }],
  usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 450 },
}));
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("BOOK_VERTEX_DISABLED", "false");
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "maw-evermore");
  vi.stubEnv("BOOK_VERTEX_LOCATION", "eu");
  getRequestHeaders.mockResolvedValue(new Headers({ Authorization: "Bearer secret-token" }));
  fetchMock.mockResolvedValue(gemini());
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("book generation", () => {
  it("uses EU Vertex, structured output and both answers without exposing credentials", async () => {
    const result = await generateBook(input);
    expect(result).toMatchObject({ source: "vertex", specification: WORLD_EXAMPLES[0], usage: { inputTokens: 120, outputTokens: 450 } });
    expect(JSON.stringify(result)).not.toContain("secret-token");
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://aiplatform.eu.rep.googleapis.com/v1/projects/maw-evermore/locations/eu/publishers/google/models/gemini-3.5-flash-lite:generateContent");
    expect(options.headers.get("Authorization")).toBe("Bearer secret-token");
    const body = JSON.parse(options.body);
    expect(JSON.parse(body.contents[0].parts[0].text)).toEqual({ whoAndWhere: input.answers[0], sleepingPlace: input.answers[1] });
    expect(body.generationConfig.responseJsonSchema.properties.spawn).toBeDefined();
  });
  it("switches Gemini models and their thinking budget", async () => {
    await generateBook({ ...input, model: "gemini-3.8-flash" });
    expect(fetchMock.mock.calls[0]![0]).toContain("gemini-3.8-flash:generateContent");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).generationConfig.thinkingConfig.thinkingLevel).toBe("LOW");
  });
  it("uses Claude rawPredict and validates its structured response", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(WORLD_EXAMPLES[1]) }], usage: { input_tokens: 50, output_tokens: 100 } })));
    const result = await generateBook({ ...input, model: "claude-sonnet-5-5" });
    expect(result).toMatchObject({ source: "vertex", specification: WORLD_EXAMPLES[1], usage: { inputTokens: 50, outputTokens: 100 } });
    expect(fetchMock.mock.calls[0]![0]).toContain("publishers/anthropic/models/claude-sonnet-5-5:rawPredict");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).output_config.format.type).toBe("json_schema");
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
  it.each([{}, { ...WORLD_EXAMPLES[0], spawn: { x: 100, y: 100 } }, { ...WORLD_EXAMPLES[0], settlement: { buildings: [{ ...WORLD_EXAMPLES[0]!.settlement.buildings[0], floors: 4, x: 63 }] } }])("rejects invalid model worlds before returning them", async spec => {
    fetchMock.mockResolvedValue(gemini(spec));
    expect(await generateBook(input)).toMatchObject({ source: "example", fallbackReason: "invalid-output", specification: WORLD_EXAMPLES[0] });
  });
  it("rejects truncated or safety-blocked output", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: JSON.stringify(WORLD_EXAMPLES[0]) }] } }] })));
    expect((await generateBook(input)).fallbackReason).toBe("invalid-output");
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

describe("book API input", () => {
  it.each([null, {}, { answers: ["", "bed"] }, { answers: ["  ", "bed"] }, { answers: ["a".repeat(4001), "bed"] }, { answers: ["forest", "bed", "extra"] }, { answers: ["forest", "bed"], model: "arbitrary/endpoint" }])("rejects invalid input before auth", async body => {
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
