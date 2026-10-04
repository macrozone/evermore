import { MAP_MODELS, type MapInput } from "../g3-map/generation";
import { VISION_MODELS } from "../g3b-map/generation";
import type { MaskResult, Region } from "../g3b-map/model";
import type { Door } from "../g3b-map/world";
export { MAP_MODELS, VISION_MODELS };
export type InteriorInput = { model: MapInput["model"]; maskModel: string };
export type Interior = { id: string; image: string; width: number; height: number; door: Door; model: string; durationMs: number; estimatedCostUsd: number; generatedAt: string; mask: MaskResult; reviewedRegions?: Region[] };
export type InteriorResponse = { room: Interior; cached: boolean; durationMs: number; requestCostUsd: number };
export function parseInteriorInput(value: unknown): InteriorInput {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Choose interior models.");
  const v = value as Record<string, unknown>, model = v.model ?? MAP_MODELS[0].id, maskModel = v.maskModel ?? VISION_MODELS[0].id;
  if (!MAP_MODELS.some(m => m.id === model) || !VISION_MODELS.some(m => m.id === maskModel)) throw new TypeError("Choose supported image and mask models.");
  return { model: model as MapInput["model"], maskModel: maskModel as string };
}
export const INTERIOR_INSTRUCTION = `The attached image is the EXTERIOR reference for one small forest cottage at dusk. Draw its INTERIOR as a playable orthogonal top-down SNES-style pixel-art room, looking from the south, horizontal/vertical edges, no isometric camera. Preserve the reference's warm palette, timber and stone materials, crisp pixel clusters and evening mood. A compact ONE-ROOM footprint proportional to this modest cottage, no mansion or extra rooms. The chimney on the right corresponds to a glowing stone fireplace on the upper-right wall. Warm window light, rustic bed, table and two chairs, small shelves; keep a broad connected empty wooden floor to walk on. Cut away roof and south wall. Show a clearly visible open exit doorway centered at the bottom/south edge, connected to the floor, framed by a short stone threshold. Align that exit with the exterior front door conceptually. Walls occupy the image margins; fill the square frame with the room, no surrounding forest, borders, text, characters or UI. Keep object pixel density like the reference. Return only the interior picture.`;
