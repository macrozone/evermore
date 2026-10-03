import { CHARACTER_MODELS } from "../character/specification";

export const WISH_MODELS = CHARACTER_MODELS;
export type WishModel = typeof WISH_MODELS[number];
export interface WishInput { wish: string; place: string; influence: number; inspiration: number; model: WishModel; mode: "offline" | "live" }
export interface WishScope { area: number; cells: number; structures: number; complexity: number; reason: string; smallerWish: string }
export interface WishUsage { inputTokens: number | null; outputTokens: number | null; thinkingTokens: number | null }
export interface WishResult { scope: WishScope; source: "vertex" | "offline"; fallbackReason?: "offline-mode" | "disabled" | "credentials" | "provider" | "invalid-output" | "limit" | "no-influence"; model: WishModel; durationMs: number; usage: WishUsage; estimatedUsd: number | null; pricingBasis: string }
export const FORMULA = "ceil((2 + area/8 + cells/64 + 3×structures) × complexity × (1 + 2×(1−influence)))";
export const PRICING_URL = "https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing";

function object(value: unknown) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Expected an object.");
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) throw new TypeError("Invalid text.");
  return value.trim();
}
function number(value: unknown, min: number, max: number, integer = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new TypeError("Invalid number.");
  return value;
}
export function parseWishInput(value: unknown): WishInput {
  const v = object(value);
  const model = v.model ?? WISH_MODELS[0];
  const mode = v.mode ?? "offline";
  if (!WISH_MODELS.includes(model as WishModel) || !["offline", "live"].includes(mode as string)) throw new TypeError("Unsupported model or mode.");
  return { wish: text(v.wish, 2000), place: text(v.place, 300), influence: number(v.influence, 0, 1), inspiration: number(v.inspiration, 0, 5000, true), model: model as WishModel, mode: mode as WishInput["mode"] };
}
export function parseWishScope(value: unknown): WishScope {
  const v = object(value);
  if (Object.keys(v).some(key => !["area", "cells", "structures", "complexity", "reason", "smallerWish"].includes(key))) throw new TypeError("Unexpected scope field.");
  const scope = { area: number(v.area, 1, 1_000_000, true), cells: number(v.cells, 1, 10_000_000, true), structures: number(v.structures, 0, 10000, true), complexity: number(v.complexity, 1, 5), reason: text(v.reason, 800), smallerWish: text(v.smallerWish, 300) };
  if (scope.cells < scope.area) throw new TypeError("Cells must include the affected footprint.");
  return scope;
}
export const WISH_SCOPE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["area", "cells", "structures", "complexity", "reason", "smallerWish"],
  properties: {
    area: { type: "integer", minimum: 1, maximum: 1_000_000 }, cells: { type: "integer", minimum: 1, maximum: 10_000_000 },
    structures: { type: "integer", minimum: 0, maximum: 10000 }, complexity: { type: "number", minimum: 1, maximum: 5 },
    reason: { type: "string", minLength: 1, maxLength: 800 }, smallerWish: { type: "string", minLength: 1, maxLength: 300 },
  },
};
export function inspirationCost(scope: WishScope, influence: number): number {
  return Math.ceil((2 + scope.area / 8 + scope.cells / 64 + 3 * scope.structures) * scope.complexity * (1 + 2 * (1 - influence)));
}
export function decideWish(scope: WishScope, influence: number, inspiration: number) {
  const cost = inspirationCost(scope, influence);
  return { cost, accepted: influence > 0 && inspiration >= cost, rejection: influence === 0 ? "no-influence" : inspiration < cost ? "insufficient-inspiration" : null };
}

const fixtures: [string, number, number, number, number][] = [
  ["A flower pot by my bed", 1, 2, 1, 1], ["Paint my front door blue", 2, 8, 0, 1],
  ["A candle on my desk", 1, 2, 1, 1], ["A small rug in my bedroom", 6, 6, 1, 1],
  ["Replace a broken window", 2, 8, 1, 1.2], ["A bench under the apple tree", 3, 6, 1, 1],
  ["Three lanterns along the path", 6, 12, 3, 1.2], ["A herb garden behind my cottage", 24, 48, 4, 1.2],
  ["A pond beside my house", 36, 108, 1, 1.5], ["A stone well in the square", 9, 72, 1, 1.5],
  ["A wooden bridge across the stream", 40, 160, 1, 2], ["A chicken coop in my garden", 24, 192, 1, 1.6],
  ["A workshop attached to my home", 64, 768, 1, 2], ["A two-storey cottage near the woods", 80, 1600, 1, 2.2],
  ["A watchtower above the harbour", 36, 1440, 1, 2.5], ["A watermill beside the river", 120, 2400, 2, 2.5],
  ["A market with ten stalls", 400, 2400, 10, 2], ["An orchard with fifty trees", 900, 5400, 50, 1.8],
  ["A village of twenty houses", 2500, 40000, 20, 3], ["A canal through the village", 1800, 14400, 4, 3],
  ["A cathedral in the city centre", 1200, 60000, 1, 4], ["A castle on a mountain", 10000, 300000, 12, 4],
  ["A floating island with waterfalls", 16000, 500000, 8, 5], ["An underground city with a hundred homes", 40000, 1600000, 100, 5],
  ["An entire mountain range around my world", 250000, 8000000, 0, 5],
];
export const WISH_EXAMPLES = fixtures.map(([wish, area, cells, structures, complexity]) => ({
  wish, scope: { area, cells, structures, complexity, reason: "Hand-authored offline fixture; assumes a one-metre cell. This is not a model estimate.", smallerWish: "Add one small decorative stone beside my bed." },
}));
export function offlineScope(wish: string): WishScope {
  const match = WISH_EXAMPLES.find(example => example.wish.toLowerCase() === wish.trim().toLowerCase());
  return match ? { ...match.scope } : { area: 8, cells: 32, structures: 1, complexity: 1.2, reason: "Unrecognised free text: generic offline placeholder (8 m², 32 cells). It does not interpret your wish or place. Use live mode for an estimate.", smallerWish: "Add one small decorative stone beside my bed." };
}
export function consistency(results: WishResult[], influence: number) {
  const live = results.filter(result => result.source === "vertex");
  if (results.length !== 3 || live.length !== 3) return null;
  const costs = live.map(result => inspirationCost(result.scope, influence));
  const min = Math.min(...costs), max = Math.max(...costs);
  const mean = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
  return { min, max, mean, relativeSpread: (max - min) / mean };
}
export function parseUsage(value: unknown): WishUsage {
  const v = value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
  const token = (key: string) => typeof v[key] === "number" && Number.isSafeInteger(v[key]) && (v[key] as number) >= 0 ? v[key] as number : null;
  const inputTokens = token("promptTokenCount"), outputTokens = token("candidatesTokenCount");
  let thinkingTokens = token("thoughtsTokenCount");
  const total = token("totalTokenCount");
  // Gemini may omit a zero thoughts count. Derive it only when a reported
  // total accounts for all tokens; absent or inconsistent totals stay unknown.
  if (thinkingTokens === null && total !== null && inputTokens !== null && outputTokens !== null && total >= inputTokens + outputTokens) thinkingTokens = total - inputTokens - outputTokens;
  return { inputTokens, outputTokens, thinkingTokens };
}
// Standard EU text rates checked 2026-10-04. Pro has only a published global
// rate, so its EU cost stays unknown. Flash uses the undiscounted 2027 rate:
// 2026 promotional credits are account-dependent. Never treat this as an invoice.
export function estimateUsd(model: WishModel, usage: WishUsage): number | null {
  if (model === "gemini-3.1-pro-preview" || Object.values(usage).some(value => value === null)) return null;
  const rates = model === "gemini-3.5-flash-lite" ? [0.33, 2.75] : [1.65, 8.25];
  return (usage.inputTokens! * rates[0]! + (usage.outputTokens! + usage.thinkingTokens!) * rates[1]!) / 1_000_000;
}
