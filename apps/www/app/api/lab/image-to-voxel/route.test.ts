import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../../../lib/heightmap-assets.mjs", () => ({ generateHeightMaps: vi.fn() }));
import { generateHeightMaps } from "../../../../lib/heightmap-assets.mjs";
const input = { source: "cabin", model: "gemini-3.1-flash-lite-image", seed: 1 };
function request(body: unknown = input, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/lab/image-to-voxel", { method: "POST", headers: { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); vi.stubEnv("NODE_ENV", "development");
  delete (globalThis as typeof globalThis & { heightmapLab?: unknown }).heightmapLab;
  vi.mocked(generateHeightMaps).mockResolvedValue({ heightmap: Buffer.from("top"), facade: Buffer.from("mask"), rawHeight: Buffer.from("raw"), metadata: { ...input, width: 8, height: 8, generatedAt: "now", durationMs: 5, estimatedCostUsd: 0.034, usage: [], prompts: { height: "labels" }, normalization: "magenta" } });
});
afterEach(() => vi.unstubAllEnvs());
describe("local heightmap endpoint", () => {
  it("blocks production, foreign origins and forwarded hosts before paying for a model", async () => {
    const { POST } = await import("./route");
    expect((await POST(request(input, { origin: "https://attacker.invalid" }))).status).toBe(403);
    expect((await POST(request(input, { forwarded: "host=localhost" }))).status).toBe(403);
    expect((await POST(request(input, { "x-forwarded-host": "attacker.invalid" }))).status).toBe(403);
    vi.stubEnv("NODE_ENV", "production");
    expect((await POST(request())).status).toBe(403);
    expect(generateHeightMaps).not.toHaveBeenCalled();
  });
  it("validates inputs and rejects oversized streamed bodies", async () => {
    const { POST } = await import("./route");
    expect((await POST(request({ ...input, source: "../../secrets" }))).status).toBe(400);
    expect((await POST(request({ ...input, model: "unknown" }))).status).toBe(400);
    expect((await POST(request({ ...input, seed: 1.5 }))).status).toBe(400);
    expect((await POST(request({ extra: "x".repeat(2000) }))).status).toBe(413);
    expect(generateHeightMaps).not.toHaveBeenCalled();
  });
  it("deduplicates in-flight work, caches results and reserves an hourly budget", async () => {
    const { POST } = await import("./route");
    const results = await Promise.all([POST(request()), POST(request())]);
    expect(results.every(response => response.ok)).toBe(true);
    expect(generateHeightMaps).toHaveBeenCalledTimes(1);
    const cached = await (await POST(request())).json();
    expect(cached.cached).toBe(true); expect(cached.facade).toContain("data:image/png;base64,");
    for (let seed = 2; seed <= 6; seed++) expect((await POST(request({ ...input, seed }))).status).toBe(200);
    expect((await POST(request({ ...input, seed: 7 }))).status).toBe(429);
    expect(generateHeightMaps).toHaveBeenCalledTimes(6);
  });
  it("returns a provider failure without trying another model", async () => {
    const { POST } = await import("./route");
    vi.mocked(generateHeightMaps).mockRejectedValue(new Error("Vertex HTTP 404; no fallback used."));
    expect((await POST(request())).status).toBe(502);
    expect(generateHeightMaps).toHaveBeenCalledTimes(1);
  });
});
