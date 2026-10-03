import type { RasterMap, RasterReport, WorldSpecification } from "@evermore/world";

export const BOOK_MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "claude-sonnet-5-5"] as const;
export type BookModel = typeof BOOK_MODELS[number];
export const DEFAULT_BOOK_MODEL: BookModel = BOOK_MODELS[0];
export type BookStrategy = "g1" | "g2";
export interface BookInput { answers: [string, string]; model: BookModel; strategy: BookStrategy }
interface GenerationMetadata {
  seed: number;
  model: BookModel;
  source: "vertex" | "example";
  fallbackReason?: "disabled" | "credentials" | "provider" | "invalid-output";
  fallbackDetail?: string;
  repairs?: string[];
  durationMs: number;
  usage?: { inputTokens: number; outputTokens: number; thinkingTokens?: number };
}
export type BookGeneration = GenerationMetadata & (
  { strategy: "g1"; specification: WorldSpecification } |
  { strategy: "g2"; raster: RasterMap; repairedRaster: RasterMap; report: RasterReport }
);
export function parseBookInput(value: unknown): BookInput {
  if (value === null || typeof value !== "object") throw new TypeError("Expected book answers.");
  const { answers, strategy = "g1", model = strategy === "g2" ? "gemini-3.8-flash" : DEFAULT_BOOK_MODEL } = value as Record<string, unknown>;
  if (!Array.isArray(answers) || answers.length !== 2 || answers.some(answer => typeof answer !== "string" || answer.trim().length === 0 || answer.length > 4000)) {
    throw new TypeError("Provide two non-empty answers of at most 4000 characters each.");
  }
  if (strategy !== "g1" && strategy !== "g2") throw new TypeError("Choose G1 or G2 generation.");
  if (!BOOK_MODELS.includes(model as BookModel)) throw new TypeError("Choose a supported model.");
  return { answers: answers.map(answer => answer.trim()) as [string, string], model: model as BookModel, strategy };
}
