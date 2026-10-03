import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { getRequestHeaders } = vi.hoisted(() => ({ getRequestHeaders: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("google-auth-library", () => ({ GoogleAuth: class { getRequestHeaders = getRequestHeaders; } }));
import { createWishEstimator } from "./generate";
import { POST } from "./route";
import { parseWishInput, WISH_EXAMPLES, WISH_MODELS } from "../../../lab/wish/model";
const input = parseWishInput({ wish: WISH_EXAMPLES[0]!.wish, place: "Bedroom", influence: 1, inspiration: 100, mode: "live" });
const fetchMock = vi.fn();
const response = (scope: unknown = WISH_EXAMPLES[0]!.scope, finishReason = "STOP", usage: unknown = { promptTokenCount: 120, candidatesTokenCount: 100, thoughtsTokenCount: 20 }) => new Response(JSON.stringify({ candidates: [{ finishReason, content: { parts: [{ text: "private reasoning", thought: true }, { text: JSON.stringify(scope) }] } }], usageMetadata: usage }));
beforeEach(() => {
  vi.stubEnv("WISH_VERTEX_ENABLED", "true"); vi.stubEnv("GOOGLE_CLOUD_PROJECT", "maw-evermore");
  vi.stubGlobal("fetch", fetchMock); fetchMock.mockImplementation(() => Promise.resolve(response()));
  getRequestHeaders.mockResolvedValue(new Headers({ Authorization: "Bearer secret-token" }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("wish estimator", () => {
  it.each(WISH_MODELS)("uses allowlisted model %s at EU Vertex with structured output and server credentials", async model => {
    const result = await createWishEstimator()({ ...input, model });
    expect(result).toMatchObject({ source: "vertex", model, usage: { inputTokens: 120, outputTokens: 100, thinkingTokens: 20 } });
    expect(JSON.stringify(result)).not.toContain("private reasoning"); expect(JSON.stringify(result)).not.toContain("secret-token");
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`https://aiplatform.eu.rep.googleapis.com/v1/projects/maw-evermore/locations/eu/publishers/google/models/${model}:generateContent`);
    expect(options.headers.get("Authorization")).toBe("Bearer secret-token");
    const body = JSON.parse(options.body);
    expect(JSON.parse(body.contents[0].parts[0].text)).toEqual({ wish: input.wish, place: input.place });
    expect(body.generationConfig.responseJsonSchema.properties.area.minimum).toBe(1);
    expect(body.generationConfig.maxOutputTokens).toBe(1024);
  });
  it("requires both server opt-in and client live mode; influence zero avoids a call", async () => {
    vi.stubEnv("WISH_VERTEX_ENABLED", "false");
    expect((await createWishEstimator()(input)).fallbackReason).toBe("disabled");
    vi.stubEnv("WISH_VERTEX_ENABLED", "true");
    expect((await createWishEstimator()({ ...input, mode: "offline" })).fallbackReason).toBe("offline-mode");
    expect((await createWishEstimator()({ ...input, influence: 0 })).fallbackReason).toBe("no-influence");
    expect(getRequestHeaders).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not shrink scope to the available inspiration", async () => {
    const estimate = createWishEstimator();
    const a = await estimate({ ...input, inspiration: 0 }); const b = await estimate({ ...input, inspiration: 5000 });
    expect(a.scope).toEqual(b.scope); expect(fetchMock.mock.calls[0]![1].body).toEqual(fetchMock.mock.calls[1]![1].body);
  });
  it("marks credential/provider failures without exposing errors", async () => {
    getRequestHeaders.mockRejectedValueOnce(new Error("secret-path"));
    expect((await createWishEstimator()(input)).fallbackReason).toBe("credentials");
    fetchMock.mockResolvedValueOnce(new Response("secret provider error", { status: 403 }));
    expect((await createWishEstimator()(input)).fallbackReason).toBe("provider");
    fetchMock.mockRejectedValueOnce(new Error("secret network error"));
    expect(JSON.stringify(await createWishEstimator()(input))).not.toContain("secret");
  });
  it("preserves usage and cost even when a billed model response is invalid", async () => {
    fetchMock.mockResolvedValueOnce(response({ ...WISH_EXAMPLES[0]!.scope, cells: -1 }));
    const result = await createWishEstimator()(input);
    expect(result).toMatchObject({ source: "offline", fallbackReason: "invalid-output", usage: { inputTokens: 120, outputTokens: 100, thinkingTokens: 20 } });
    expect(result.estimatedUsd).toBeGreaterThan(0);
  });
  it("rejects truncation and keeps absent usage unknown", async () => {
    fetchMock.mockResolvedValueOnce(response(undefined, "MAX_TOKENS", null));
    expect(await createWishEstimator()(input)).toMatchObject({ fallbackReason: "invalid-output", estimatedUsd: null, usage: { inputTokens: null, outputTokens: null, thinkingTokens: null } });
  });
  it("caps concurrent, minute and lifetime attempts including provider failures", async () => {
    let now = 0;
    const estimate = createWishEstimator(() => now);
    getRequestHeaders.mockReturnValueOnce(new Promise(() => {}));
    vi.useFakeTimers();
    try {
      const pending = estimate(input);
      expect((await estimate(input)).fallbackReason).toBe("limit");
      await vi.advanceTimersByTimeAsync(12000);
      expect((await pending).fallbackReason).toBe("credentials");
    } finally { vi.useRealTimers(); }
    for (let i = 1; i < 30; i++) {
      if (i % 6 === 0) now += 60000;
      expect((await estimate(input)).source).toBe("vertex");
      if (i === 5) expect((await estimate(input)).fallbackReason).toBe("limit");
    }
    now += 60000;
    expect((await estimate(input)).fallbackReason).toBe("limit");
  });
});
describe("wish route", () => {
  it.each([{}, { ...input, influence: 2 }, { ...input, inspiration: -1 }, { ...input, model: "arbitrary/endpoint" }])("rejects invalid bodies before ADC", async body => {
    const result = await POST(new Request("http://localhost/api/lab/wish", { method: "POST", body: JSON.stringify(body) }));
    expect(result.status).toBe(400); expect(getRequestHeaders).not.toHaveBeenCalled();
  });
  it("bounds streamed input without content-length", async () => {
    const result = await POST(new Request("http://localhost/api/lab/wish", { method: "POST", body: "a".repeat(16001) }));
    expect(result.status).toBe(413); expect(getRequestHeaders).not.toHaveBeenCalled();
  });
  it("rejects cross-origin calls", async () => {
    const result = await POST(new Request("http://localhost/api/lab/wish", { method: "POST", headers: { Origin: "https://other.example" }, body: JSON.stringify(input) }));
    expect(result.status).toBe(403); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns an uncached offline result with live disabled and the browser Host", async () => {
    vi.stubEnv("WISH_VERTEX_ENABLED", "false");
    const result = await POST(new Request("http://localhost/api/lab/wish", { method: "POST", headers: { Host: "127.0.0.1", Origin: "http://127.0.0.1" }, body: JSON.stringify(input) }));
    expect(result.headers.get("Cache-Control")).toBe("no-store"); expect(await result.json()).toMatchObject({ source: "offline", fallbackReason: "disabled" });
  });
});
