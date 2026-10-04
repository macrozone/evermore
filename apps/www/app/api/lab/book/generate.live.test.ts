import { expect, it, vi } from "vitest";
import { parseWorldSpecification } from "@evermore/world";
vi.mock("server-only", () => ({}));
import { generateBook } from "./generate";
import { parseBookInput } from "../../../lab/book/generation";

// Opt-in acceptance check against Vertex using local ADC; never part of CI.
it.skipIf(process.env.BOOK_LIVE_ACCEPTANCE !== "true")("interprets at least nine of ten book passages on Vertex", async () => {
  const passages = [
    ["I am a botanist living in a quiet forest village.", "In my cottage next to the old stone."],
    ["I am a sailor living by a small harbour.", "Above the harbour inn."],
    ["I am a historian exploring desert ruins.", "Inside a restored ancient sanctuary."],
    ["I am a monk living in a snowy mountain monastery.", "In a small monastery bedroom."],
    ["I am a carpenter beside a pine forest.", "In a timber house next to my workshop."],
    ["I am a fisher on a rocky coast.", "In my blue cottage near a beacon."],
    ["I am a gardener in a forest with an emerald and brown palette.", "In a cottage near a river."],
    ["I am a shepherd in a cold mountain village.", "In a small two-storey stone home."],
    ["I am a merchant in a desert oasis.", "Above my shop beside a standing stone."],
    ["I am a painter in a forest settlement of three houses.", "In the smallest house near my studio."],
  ];
  let interpreted = 0;
  for (const [i, answers] of passages.entries()) {
    const result = await generateBook(parseBookInput({ answers }));
    expect(result.strategy).toBe("g1");
    if (result.strategy !== "g1") throw new Error("Expected a semantic G1 world.");
    console.info(JSON.stringify({ case: i + 1, source: result.source, name: result.specification.name, durationMs: result.durationMs, repairs: result.repairs, fallbackReason: result.fallbackReason, fallbackDetail: result.fallbackDetail }));
    parseWorldSpecification(result.specification);
    if (result.source === "vertex") interpreted++;
    // A missing environment cannot measure generation quality.
    if (result.fallbackReason === "credentials" || result.fallbackReason === "disabled") throw new Error(`Live acceptance unavailable: ${result.fallbackReason}`);
  }
  expect(interpreted).toBeGreaterThanOrEqual(9);
}, 150_000);
