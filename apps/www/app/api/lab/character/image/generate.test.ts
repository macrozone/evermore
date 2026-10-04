import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { headers } = vi.hoisted(() => ({ headers: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("google-auth-library", () => ({ GoogleAuth: class { getRequestHeaders = headers; } }));
import { createCharacterImageGenerator, callCharacterVertex, CharacterImageError } from "./generate";
import { decodeImage, prepareCharacterSheet } from "./prepare";
import { POST } from "./route";
import { parseImageInput } from "../../../../lab/character/image-specification";

const input = parseImageInput({ description: "I am a donkey." });
const sprites = Array.from({ length: 16 }, (_, i) => ({ input: Buffer.from([80, 110, 60, 255]), raw: { width: 1, height: 1, channels: 4 as const }, left: i % 4 * 16 + 7 + i % 2, top: Math.floor(i / 4) * 16 + 12 }));
const source = await sharp({ create: { width: 64, height: 64, channels: 4, background: "#ff00ff" } }).composite(sprites).png().toBuffer();
const provider = vi.fn(async (_input: Parameters<typeof callCharacterVertex>[0]) => ({ bytes: source, cost: 0.04 }));
const request = (body: unknown = input, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/lab/character/image", { method: "POST", headers: { origin }, body: JSON.stringify(body) });
beforeEach(() => { vi.stubEnv("NODE_ENV", "development"); headers.mockResolvedValue(new Headers({ Authorization: "Bearer test" })); provider.mockClear(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("character image pipeline", () => {
  it("makes a reference and a sheet, then edits the current raw sheet, preserving parent provenance", async () => {
    const generator = createCharacterImageGenerator(provider);
    const first = await generator.generate(input);
    expect(first.character.calls.map(c => c.stage)).toEqual(["reference", "sheet"]);
    expect(first.character.estimatedCostUsd).toBe(0.08);
    const second = await generator.generate({ ...input, description: "Make it smile", referenceId: first.character.id });
    expect(second.character.parentId).toBe(first.character.id);
    expect(second.character.calls.map(c => c.stage)).toEqual(["edit"]);
    expect(provider.mock.calls).toHaveLength(3);
    expect(provider.mock.calls[2]![0]).toMatchObject({ reference: Buffer.from(first.character.raw.split(",")[1]!, "base64") });
    expect(second.rate.used).toBe(3);
  });
  it("keeps common dimensions and preserves between-frame offsets", async () => {
    const sheet = await prepareCharacterSheet(source);
    expect(sheet.frames).toHaveLength(16);
    expect(sheet.frames.every(f => f.pixels === 1 && f.bottom === 12)).toBe(true);
    const { data, info } = await sharp(sheet.sheet).raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([128, 172]);
    expect(data[3]).toBe(0);
    // Adjacent source pixels occupy different positions within the common cell transform.
    const xs = (cell: number) => Array.from({ length: 32 }, (_, x) => x).filter(x => (data[((40 * info.width) + cell * 32 + x) * 4 + 3] ?? 0) > 0);
    expect(xs(0)).not.toEqual(xs(1));
  });
  it("removes model-drawn separators before shared bounds and quantizes one palette", async () => {
    const grid = Buffer.from(`<svg width="64" height="64"><path d="M16 0V64M32 0V64M48 0V64M0 16H64M0 32H64M0 48H64" stroke="black" stroke-width="1"/></svg>`);
    // At high model resolutions the reserved gutter removes separator lines.
    const large = await sharp(source).resize(1024, 1024, { kernel: "nearest" }).png().toBuffer();
    const lines = await sharp(grid).resize(1024, 1024).png().toBuffer();
    const combined = await sharp(large).composite([{ input: lines }]).png().toBuffer();
    const prepared = await prepareCharacterSheet(combined);
    expect(prepared.frames.every(f => f.width < 256 && f.height < 256)).toBe(true);
    const { data, info } = await sharp(prepared.sheet).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const colors = new Set<string>();
    for (let i = 0; i < data.length; i += info.channels) if (data[i + 3] !== 0) colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    expect(colors.size).toBeLessThanOrEqual(32);
  });
  it("rejects empty and malformed grids", async () => {
    const empty = await sharp({ create: { width: 64, height: 64, channels: 4, background: "#ff00ff" } }).png().toBuffer();
    await expect(prepareCharacterSheet(empty)).rejects.toThrow("empty");
    await expect(prepareCharacterSheet(await sharp(source).resize(63, 64).png().toBuffer())).rejects.toThrow("4 × 4");
    await expect(decodeImage(Buffer.from("bad"))).rejects.toThrow();
  });
  it("retains partial completed call costs when sheet generation fails", async () => {
    const mock = vi.fn().mockResolvedValueOnce({ bytes: source, cost: 0.04 }).mockRejectedValueOnce(new CharacterImageError("Unavailable"));
    try { await createCharacterImageGenerator(mock).generate(input); expect.fail("should fail"); }
    catch (error) { expect(error).toMatchObject({ message: "Unavailable", calls: [{ stage: "reference", estimatedCostUsd: 0.04 }] }); }
  });
  it("reserves the full workflow before concurrent calls and bounds retained references", async () => {
    const generator = createCharacterImageGenerator(provider);
    const results = await Promise.all(Array.from({ length: 10 }, () => generator.generate(input)));
    expect(results).toHaveLength(10);
    await expect(generator.generate(input)).rejects.toMatchObject({ status: 429 });
    
    expect(provider).toHaveBeenCalledTimes(20);
  });
  it("evicts the oldest reference after eight variants", async () => {
    const generator = createCharacterImageGenerator(provider);
    const first = await generator.generate(input);
    for (let i = 0; i < 8; i++) await generator.generate(input);
    await expect(generator.generate({ ...input, referenceId: first.character.id })).rejects.toMatchObject({ status: 410 });
  });
  it("expires rolling reservations but retains failed-call reservations", async () => {
    let time = 0;
    const generator = createCharacterImageGenerator(async () => { throw new Error("provider"); }, () => time);
    for (let i = 0; i < 10; i++) await expect(generator.generate(input)).rejects.toThrow("provider");
    await expect(generator.generate(input)).rejects.toMatchObject({ status: 429 });
    time = 3_600_001;
    expect(generator.rate().used).toBe(0);
  });
  it("rejects unknown references before making paid calls", async () => {
    await expect(createCharacterImageGenerator(provider).generate({ ...input, referenceId: "a".repeat(32) })).rejects.toMatchObject({ status: 410 });
    expect(provider).not.toHaveBeenCalled();
  });
});

describe("local route and Vertex request", () => {
  it.each([null, {}, { description: " " }, { description: "a".repeat(2001) }, { description: "donkey", model: "other" }, { description: "donkey", referenceId: "https://example.com/image" }])("rejects invalid input before credentials", async value => {
    expect((await POST(request(value))).status).toBe(400); expect(headers).not.toHaveBeenCalled();
  });
  it("rejects production, cross-origin and oversized requests", async () => {
    expect((await POST(request(input, "http://foreign.example"))).status).toBe(403);
    expect((await POST(request({ description: "a".repeat(12_001) }))).status).toBe(413);
    vi.stubEnv("NODE_ENV", "production");
    expect((await POST(request())).status).toBe(403);
    expect(headers).not.toHaveBeenCalled();
  });
  it("sends a selected model and inline image reference; never substitutes on provider failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: source.toString("base64") } }] } }] })));
    vi.stubGlobal("fetch", fetchMock);
    const result = await callCharacterVertex({ model: input.model, prompt: "edit", reference: source });
    expect(result.bytes).toEqual(source);
    const [url, settings] = fetchMock.mock.calls[0]!;
    expect(url).toContain(input.model);
    const body = JSON.parse(settings.body);
    expect(body.contents[0].parts[0].inlineData.data).toBe(source.toString("base64"));
    expect(body.generationConfig.responseModalities).toContain("IMAGE");
    fetchMock.mockResolvedValue(new Response("unavailable", { status: 404 }));
    await expect(callCharacterVertex({ model: input.model, prompt: "donkey" })).rejects.toThrow("404");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
