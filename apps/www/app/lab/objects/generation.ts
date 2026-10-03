import { OBJECT_TILE_SIZE, type LibraryObject, type ObjectPalette } from "../../../lib/objects";

/** Global Vertex standard prices checked 2026-10-03; estimates, not invoices.
 * https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing
 */
export const OBJECT_MODELS = [
  { id: "gemini-3.1-flash-lite-image", label: "Flash-Lite", imageUsd: 0.0336, inputPerMillion: 0.25, textPerMillion: 1.5 },
  { id: "gemini-3.1-flash-image", label: "Flash", imageUsd: 0.0672, inputPerMillion: 0.5, textPerMillion: 3 },
  { id: "gemini-3-pro-image", label: "Pro", imageUsd: 0.1344, inputPerMillion: 2, textPerMillion: 12 },
] as const;
export type ObjectModel = typeof OBJECT_MODELS[number]["id"];
export type ObjectInput = {
  prompt: string; model: ObjectModel; seed: number; variants: number;
  kind: LibraryObject["kind"]; widthTiles?: number; heightTiles?: number;
  pixelSize: number; palette: ObjectPalette;
};
export type GeneratedObject = LibraryObject & {
  raw: string; model: ObjectModel; prompt: string; seed: number;
  durationMs: number; estimatedCostUsd: number; generatedAt: string;
  footprintSource: "heuristic"; pixelSize: number; palette: ObjectPalette;
};
export type ObjectRate = { used: number; limit: number; resetsAt: number };
export type ObjectGeneration = {
  objects: GeneratedObject[]; errors: { seed: number; error: string }[];
  durationMs: number; estimatedCostUsd: number; cached: boolean; rate: ObjectRate;
};
const integer = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
export function parseObjectInput(value: unknown): ObjectInput {
  if (value === null || typeof value !== "object") throw new TypeError("Provide object settings.");
  const v = value as Record<string, unknown>;
  if (typeof v.prompt !== "string" || v.prompt.trim() === "" || v.prompt.trim().length > 500) throw new TypeError("Describe one object in 1–500 characters.");
  const model = v.model ?? OBJECT_MODELS[0].id;
  if (!OBJECT_MODELS.some(m => m.id === model)) throw new TypeError("Choose a supported image model.");
  const seed = v.seed ?? 1, variants = v.variants ?? 2, kind = v.kind ?? "decoration", pixelSize = v.pixelSize ?? 1, palette = v.palette ?? "original";
  if (!integer(seed, 0, 2_147_483_643) || !integer(variants, 2, 4)) throw new TypeError("Use an integer seed and 2–4 variants.");
  if ((typeof kind !== "string" || !["building", "vegetation", "decoration"].includes(kind))) throw new TypeError("Choose an object kind.");
  if (!integer(pixelSize, 1, 4) || (typeof palette !== "string" || !["original", "hearth", "dusk"].includes(palette))) throw new TypeError("Choose valid pixel and palette settings.");
  const hasSize = v.widthTiles !== undefined || v.heightTiles !== undefined;
  if (hasSize && (!integer(v.widthTiles, 1, 8) || !integer(v.heightTiles, 1, 8))) throw new TypeError("Sprite width and height must both be 1–8 tiles.");
  return { prompt: v.prompt.trim(), model: model as ObjectModel, seed, variants, kind: kind as LibraryObject["kind"], pixelSize, palette: palette as ObjectPalette,
    ...(hasSize ? { widthTiles: v.widthTiles as number, heightTiles: v.heightTiles as number } : {}) };
}
export function estimateObject(input: ObjectInput): Omit<LibraryObject, "id" | "name" | "sprite"> {
  const defaults = input.kind === "building" ? [4, 4] : input.kind === "vegetation" ? [3, 4] : [2, 3];
  const widthTiles = input.widthTiles ?? defaults[0]!, heightTiles = input.heightTiles ?? defaults[1]!;
  const columns = input.kind === "vegetation" ? 1 : widthTiles;
  const rows = input.kind === "vegetation" ? 1 : Math.max(1, Math.floor(heightTiles * (input.kind === "building" ? 0.75 : 0.5)));
  const cells = Array.from({ length: columns * rows }, (_, i) => [i % columns, Math.floor(i / columns)] as const);
  return { kind: input.kind, width: widthTiles * OBJECT_TILE_SIZE, height: heightTiles * OBJECT_TILE_SIZE,
    heightTiles: Math.max(1, heightTiles - Math.floor(rows / 2)), footprint: { columns, rows, occupied: cells, collision: cells },
    ...(input.kind === "building" ? { entrance: { x: Math.floor(columns / 2), y: rows } } : {}) };
}
