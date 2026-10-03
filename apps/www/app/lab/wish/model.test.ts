import { describe, expect, it } from "vitest";
import { consistency, decideWish, estimateUsd, inspirationCost, offlineScope, parseUsage, parseWishInput, parseWishScope, WISH_EXAMPLES, type WishResult } from "./model";
const input = { wish: "A flower pot by my bed", place: "Bedroom", influence: 1, inspiration: 100 };
describe("wish scope and inspiration", () => {
  it("has 25 valid fixtures from a tiny decoration to terrain changes", () => {
    expect(WISH_EXAMPLES).toHaveLength(25);
    const costs = WISH_EXAMPLES.map(example => inspirationCost(parseWishScope(example.scope), 1));
    expect(costs[0]).toBe(6);
    expect(costs.at(-1)).toBeGreaterThan(5000);
    expect(offlineScope("any unrecognised wish").reason).toContain("does not interpret");
  });
  it.each([null, [], {}, { ...input, wish: " " }, { ...input, wish: "a".repeat(2001) }, { ...input, place: "a".repeat(301) }, { ...input, influence: -1 }, { ...input, influence: NaN }, { ...input, inspiration: 5001 }, { ...input, inspiration: 0.2 }, { ...input, model: "bad/endpoint" }, { ...input, mode: "generate" }])("rejects invalid input %j", value => { expect(() => parseWishInput(value)).toThrow(); });
  it.each([{ cells: 0 }, { area: 0 }, { area: 10.2 }, { cells: 1 }, { structures: -1 }, { complexity: 6 }, { reason: "" }, { smallerWish: "" }, { arbitrary: 1 }])("rejects invalid provider output %j", change => { expect(() => parseWishScope({ ...WISH_EXAMPLES[8]!.scope, ...change })).toThrow(); });
  it("accepts exactly enough inspiration, rejects zero influence and scales monotonically", () => {
    const scope = WISH_EXAMPLES[0]!.scope;
    expect(decideWish(scope, 1, 6).accepted).toBe(true);
    expect(decideWish(scope, 1, 5).rejection).toBe("insufficient-inspiration");
    expect(decideWish(scope, 0, 5000).rejection).toBe("no-influence");
    expect(inspirationCost(scope, 0.01)).toBeGreaterThan(inspirationCost(scope, 1));
    expect(inspirationCost({ ...scope, area: 100, cells: 100 }, 1)).toBeGreaterThan(6);
  });
  it("preserves unknown usage and accounts for separately billed thinking", () => {
    expect(parseUsage({ promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 }).thinkingTokens).toBe(0);
    expect(parseUsage({ promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 180 }).thinkingTokens).toBe(30);
    expect(parseUsage({ promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 90 }).thinkingTokens).toBeNull();
    expect(parseUsage(undefined)).toEqual({ inputTokens: null, outputTokens: null, thinkingTokens: null });
    expect(parseUsage({ promptTokenCount: -1, candidatesTokenCount: 0.5, thoughtsTokenCount: "0" })).toEqual(parseUsage(undefined));
    expect(estimateUsd("gemini-3.5-flash-lite", { inputTokens: 1000, outputTokens: 100, thinkingTokens: 200 })).toBeCloseTo(0.001155);
    expect(estimateUsd("gemini-3.5-flash-lite", { inputTokens: 1000, outputTokens: 100, thinkingTokens: null })).toBeNull();
    expect(estimateUsd("gemini-3.1-pro-preview", { inputTokens: 100, outputTokens: 100, thinkingTokens: 0 })).toBeNull();
  });
  it("only reports consistency for three live estimates", () => {
    const result: WishResult = { scope: WISH_EXAMPLES[0]!.scope, source: "vertex", model: "gemini-3.5-flash-lite", durationMs: 10, usage: parseUsage(undefined), estimatedUsd: null, pricingBasis: "test" };
    expect(consistency([result, result], 1)).toBeNull();
    expect(consistency([result, result, { ...result, source: "offline" }], 1)).toBeNull();
    expect(consistency([result, result, { ...result, scope: { ...result.scope, structures: 2 } }], 1)).toMatchObject({ min: 6, max: 9, mean: 7, relativeSpread: 3 / 7 });
  });
});
