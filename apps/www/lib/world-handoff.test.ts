import { generateWorld, WORLD_EXAMPLES } from "@evermore/world";
import { describe, expect, it } from "vitest";
import { decodeWorldHash, encodeWorldHash, LAST_SPEC_KEY, loadWorldHandoff, parseWorldHandoff, saveWorldHandoff } from "./world-handoff";

const handoff = { specification: { ...WORLD_EXAMPLES[0]!, name: "Märchenwald 🌲" }, seed: 123456 };

describe("world specification handoff", () => {
  it("round-trips Unicode specifications and numeric seeds through compressed links", async () => {
    const hash = await encodeWorldHash(handoff);
    expect(hash).toMatch(/^#spec=[\w-]+$/);
    expect(hash.length).toBeLessThan(JSON.stringify(handoff).length);
    const decoded = await decodeWorldHash(hash);
    expect(decoded).toEqual(handoff);
    expect(generateWorld(decoded!.specification, decoded!.seed).seed).toBe(generateWorld(handoff.specification, handoff.seed).seed);
  });
  it("accepts pasted raw specifications and book JSON, validating both", () => {
    expect(parseWorldHandoff(JSON.stringify(handoff.specification), "edited-seed")).toEqual({ ...handoff, seed: "edited-seed" });
    expect(parseWorldHandoff(JSON.stringify(handoff))).toEqual(handoff);
    expect(() => parseWorldHandoff("{broken")).toThrow();
    expect(() => parseWorldHandoff(JSON.stringify({ ...handoff, specification: { ...handoff.specification, version: 2 } }))).toThrow();
    expect(() => parseWorldHandoff(JSON.stringify({ ...handoff, seed: null }))).toThrow("Seed");
  });
  it("saves the shared storage key and prefers an explicit link to storage", async () => {
    let saved = "";
    saveWorldHandoff(handoff, { setItem(key, value) { expect(key).toBe(LAST_SPEC_KEY); saved = value; } });
    expect(await loadWorldHandoff("", () => saved)).toEqual(handoff);
    expect(await loadWorldHandoff("#unrelated", () => null)).toBeNull();
    expect(await loadWorldHandoff(await encodeWorldHash(handoff), () => { throw new Error("Storage unavailable"); })).toEqual(handoff);
  });
  it("reports malformed links and saved JSON without silently substituting another world", async () => {
    await expect(loadWorldHandoff("#spec=broken", () => JSON.stringify(handoff))).rejects.toThrow();
    await expect(decodeWorldHash("#spec=")).rejects.toThrow();
    await expect(decodeWorldHash("#spec=%21")).rejects.toThrow();
    await expect(loadWorldHandoff("", () => "{}")).rejects.toThrow();
  });
  it("bounds both encoded input and decompressed payloads", async () => {
    await expect(decodeWorldHash(`#spec=${"x".repeat(64_001)}`)).rejects.toThrow("link");
    const stream = new Blob([" ".repeat(64_001)]).stream().pipeThrough(new CompressionStream("deflate"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    const hash = `#spec=${btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")}`;
    await expect(decodeWorldHash(hash)).rejects.toThrow("too large");
  });
});
