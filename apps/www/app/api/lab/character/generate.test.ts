import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHARACTER_EXAMPLES, parseCharacterInput } from "../../../lab/character/specification";

const { getRequestHeaders } = vi.hoisted(() => ({ getRequestHeaders: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("google-auth-library", () => ({ GoogleAuth: class { getRequestHeaders = getRequestHeaders; } }));
import { generateCharacter } from "./generate";
import { POST } from "./route";

const input = parseCharacterInput({ description: "A botanist with copper hair" });
const fetchMock = vi.fn();
const result = (spec: unknown = CHARACTER_EXAMPLES[0]!.specification, finishReason = "STOP") => new Response(JSON.stringify({
  candidates: [{ finishReason, content: { parts: [{ thought: true, text: "private reasoning" }, { text: JSON.stringify(spec) }] } }],
}));
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("CHARACTER_VERTEX_DISABLED", "false");
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "maw-evermore");
  vi.stubEnv("CHARACTER_VERTEX_LOCATION", "eu");
  getRequestHeaders.mockResolvedValue(new Headers({ Authorization: "Bearer secret-token" }));
  fetchMock.mockResolvedValue(result());
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("text-model character generation", () => {
  it("uses structured EU Vertex output and never exposes credentials or reasoning", async () => {
    const generated = await generateCharacter(input);
    expect(generated).toMatchObject({ source: "vertex", model: input.model, specification: CHARACTER_EXAMPLES[0]!.specification });
    expect(JSON.stringify(generated)).not.toMatch(/secret-token|private reasoning/);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://aiplatform.eu.rep.googleapis.com/v1/projects/maw-evermore/locations/eu/publishers/google/models/gemini-3.5-flash-lite:generateContent");
    const body = JSON.parse(options.body);
    expect(JSON.parse(body.contents[0].parts[0].text)).toEqual({ description: input.description });
    expect(body.generationConfig.responseJsonSchema.properties.accessory.enum).toContain("satchel");
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  it.each(["gemini-3.8-flash", "gemini-3.1-pro-preview"] as const)("selects %s", async model => {
    expect((await generateCharacter({ ...input, model })).model).toBe(model);
    expect(fetchMock.mock.calls[0]![0]).toContain(`/models/${model}:generateContent`);
  });
  it("labels disabled generation as a preset without authenticating", async () => {
    vi.stubEnv("CHARACTER_VERTEX_DISABLED", "true");
    expect(await generateCharacter(input)).toMatchObject({ source: "example", fallbackReason: "disabled" });
    expect(getRequestHeaders).not.toHaveBeenCalled();
  });
  it("falls back without leaking credential details", async () => {
    getRequestHeaders.mockRejectedValue(new Error("private credential path"));
    const generated = await generateCharacter({ ...input, description: "A wizard" });
    expect(generated).toMatchObject({ source: "example", fallbackReason: "credentials", specification: CHARACTER_EXAMPLES[1]!.specification });
    expect(JSON.stringify(generated)).not.toContain("private");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["http", "network", "json"])("labels %s failure", async kind => {
    if (kind === "http") fetchMock.mockResolvedValue(new Response("private error", { status: 403 }));
    else if (kind === "network") fetchMock.mockRejectedValue(new Error("private network error"));
    else fetchMock.mockResolvedValue(new Response("malformed"));
    expect(await generateCharacter(input)).toMatchObject({ source: "example", fallbackReason: "provider" });
  });
  it.each([{}, { ...CHARACTER_EXAMPLES[0]!.specification, accessory: "sword" }, { ...CHARACTER_EXAMPLES[0]!.specification, colors: { skin: "red" } }])("rejects invalid model output", async spec => {
    fetchMock.mockResolvedValue(result(spec));
    expect(await generateCharacter(input)).toMatchObject({ source: "example", fallbackReason: "invalid-output" });
  });
  it("rejects truncated output even if its JSON is valid", async () => {
    fetchMock.mockResolvedValue(result(CHARACTER_EXAMPLES[0]!.specification, "MAX_TOKENS"));
    expect((await generateCharacter(input)).fallbackReason).toBe("invalid-output");
  });
  it("bounds stalled authentication", async () => {
    vi.useFakeTimers();
    try {
      getRequestHeaders.mockReturnValue(new Promise(() => {}));
      const pending = generateCharacter(input);
      await vi.advanceTimersByTimeAsync(12_000);
      expect(await pending).toMatchObject({ source: "example", fallbackReason: "credentials" });
    } finally { vi.useRealTimers(); }
  });
});

describe("character API", () => {
  it.each([null, [], {}, { description: " " }, { description: "a".repeat(2001) }, { description: "A traveller", model: "arbitrary/endpoint" }])("rejects bad input before auth", async body => {
    const response = await POST(new Request("http://localhost/api/lab/character", { method: "POST", body: JSON.stringify(body) }));
    expect(response.status).toBe(400);
    expect(getRequestHeaders).not.toHaveBeenCalled();
  });
  it("bounds streamed request bodies without Content-Length", async () => {
    const response = await POST(new Request("http://localhost/api/lab/character", { method: "POST", body: "a".repeat(12_001) }));
    expect(response.status).toBe(413);
    expect(getRequestHeaders).not.toHaveBeenCalled();
  });
  it("returns validated uncached character JSON", async () => {
    const response = await POST(new Request("http://localhost/api/lab/character", { method: "POST", body: JSON.stringify(input) }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ source: "vertex", specification: CHARACTER_EXAMPLES[0]!.specification });
  });
});
