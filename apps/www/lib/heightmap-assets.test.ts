import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
vi.mock("google-auth-library", () => ({ GoogleAuth: class { getRequestHeaders() { return Promise.resolve({}); } } }));
import { generateHeightMaps } from "./heightmap-assets.mjs";

describe("shared top and facade labels", () => {
  it("extracts a binary mask from one paid label image and excludes facade brightness", async () => {
    const label = await sharp({ create: { width: 1376, height: 768, channels: 3, background: "#cccccc" } })
      .composite([{ input: Buffer.from('<svg width="1376" height="768"><rect x="310" y="300" width="480" height="120" fill="#ff00ff"/></svg>') }]).png().toBuffer();
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: label.toString("base64") } }] } }], usageMetadata: { promptTokenCount: 1431 } }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await generateHeightMaps({ publicDir: "public", source: "cabin", model: "gemini-3.1-flash-lite-image" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const top = await sharp(result.heightmap).greyscale().raw().toBuffer(), mask = await sharp(result.facade).greyscale().raw().toBuffer();
      expect([...new Set(top)]).toEqual([204, 0]); expect([...new Set(mask)]).toEqual([0, 255]);
      expect(mask[500 + 350 * 1376]).toBe(255); expect(top[500 + 350 * 1376]).toBe(0);
      expect(mask[500 + 200 * 1376]).toBe(0); expect(top[500 + 200 * 1376]).toBe(204);
      expect(result.metadata.estimatedCostUsd).toBeCloseTo(0.03395775);
    } finally { vi.unstubAllGlobals(); }
  });
  it("ships six top codes and a binary mask with no timber detail inside the cabin wall", async () => {
    const top = await sharp(await readFile("public/image-to-voxel/cabin-top-height.png")).greyscale().raw().toBuffer();
    const mask = await sharp(await readFile("public/image-to-voxel/cabin-facade.png")).greyscale().raw().toBuffer();
    expect([...new Set(top)].every(value => [0, 51, 102, 153, 204, 255].includes(value))).toBe(true);
    expect([...new Set(mask)].sort((a, b) => a - b)).toEqual([0, 255]);
    // Safe annotated plaster, timber and lit-window pixels on the same front wall.
    for (const [x, y] of [[400, 330], [480, 350], [680, 340]]) {
      expect(mask[x! + y! * 1376]).toBe(255); expect(top[x! + y! * 1376]).toBe(0);
    }
  });
});
