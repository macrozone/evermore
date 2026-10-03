/** Vertex global standard rates checked 2026-10-04; estimates, not invoices.
 * https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing
 */
export const MAP_MODELS = [
  { id: "gemini-3.1-flash-lite-image", label: "Flash-Lite", imageUsd: 0.0336, inputPerMillion: 0.25, textPerMillion: 1.5, imagePerMillion: 30 },
  { id: "gemini-3.1-flash-image", label: "Flash", imageUsd: 0.0672, inputPerMillion: 0.5, textPerMillion: 3, imagePerMillion: 60 },
  { id: "gemini-3-pro-image", label: "Pro", imageUsd: 0.1344, inputPerMillion: 2, textPerMillion: 12, imagePerMillion: 120 },
] as const;
export type MapInput = { prompt: string; seed: number; model: typeof MAP_MODELS[number]["id"] };
export const MAX_OUTPUT_TOKENS = 4096;
export const MAP_STYLE = "Draw a complete orthogonal top-down pixel-art RPG map, aligned to the horizontal and vertical axes like a SNES RPG or Stardew Valley. North is up, east is right. Consistent square tile scale. Show paths, terrain, water, tree canopies and building roofs from above, with restrained southern facades. No isometric view, diagonal camera, perspective, horizon, labels, text, UI or decorative frame. A modern 16-bit pixel-art world, legible silhouettes, crisp pixel clusters, distinct material colours, soft lighting without hiding terrain. Fill the whole square map. This is a whole map, not an isolated sprite or asset sheet.";
export type MapBudget = { calls: number; callLimit: number; reservedUsd: number; limitUsd: number; resetsAt: number };
export type GeneratedMap = MapInput & { image: string; width: number; height: number; durationMs: number; generatedAt: string; estimatedCostUsd: number; costBasis: "usage" | "image-only" };
export type MapGeneration = { map: GeneratedMap; cached: boolean; requestCostUsd: number; durationMs: number; budget: MapBudget };
export function parseMapInput(value: unknown): MapInput {
  if (value === null || value === undefined || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Provide map settings.");
  const input = value as Record<string, unknown>;
  if (typeof input.prompt !== "string" || input.prompt.trim() === "" || input.prompt.trim().length > 500) throw new TypeError("Describe a map in 1–500 characters.");
  const seed = input.seed ?? 1, model = input.model ?? MAP_MODELS[0].id;
  if (typeof seed !== "number" || !Number.isInteger(seed) || seed < 0 || seed > 2_147_483_647) throw new TypeError("Use a non-negative integer seed up to 2147483647.");
  if (!MAP_MODELS.some(entry => entry.id === model)) throw new TypeError("Choose Flash-Lite, Flash or Pro.");
  return { prompt: input.prompt.trim(), seed, model: model as MapInput["model"] };
}
/** Conservative estimated reservation; prompt is capped and contains no image inputs. */
export function reservationUsd(input: MapInput) {
  const model = MAP_MODELS.find(entry => entry.id === input.model)!;
  return (1000 * model.inputPerMillion + MAX_OUTPUT_TOKENS * model.imagePerMillion) / 1_000_000;
}
