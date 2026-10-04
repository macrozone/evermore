import { MAP_MODELS } from "../g3-map/generation";
import type { SOURCES, Approach } from "./model";
/** Global standard/promotional estimates checked 2026-10-04: https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing */
export const VISION_MODELS = [
  { id: "gemini-3.5-flash-lite", label: "Flash-Lite", inputPerMillion: .30, outputPerMillion: 2.5 },
  { id: "gemini-3.8-flash", label: "Flash", inputPerMillion: .75, outputPerMillion: 3.75 },
  { id: "gemini-3.1-pro-preview", label: "Pro", inputPerMillion: 2, outputPerMillion: 12 },
] as const;
export { MAP_MODELS };
export type MaskInput = { source: typeof SOURCES[number]["id"] | "live"; image?: string; approach: Approach; model: string };
export const IMAGE_INSTRUCTION = `Edit this RPG map into a perfectly registered categorical mask. Keep the exact framing, aspect ratio and coordinates. Fill every pixel with one of four flat colours, no shading, text, outlines or transparency: WHITE #ffffff = walkable ground; BLACK #000000 = blocked ground footprint; RED #ff0000 = overhead only; MAGENTA #ff00ff = blocked AND overhead. Collision means walls, trunks, water, fences, dense bushes; paths, grass, bridge deck and door openings are free. Roofs, tree crowns, bridge railings are overhead. A tree's trunk is blocked but its crown is overhead. Infer the small ground footprint behind its crown, not the entire crown. Roofs are overhead, walls are blocked, a door opening is free. Preserve precise object edges. Never redraw, move or add objects. Return only the colour mask.`;
export const VISION_INSTRUCTION = `Analyse this RPG map in image coordinates. Return JSON {"regions":[{"label":"...","kind":"collision|overhead|free","polygon":[[x,y],...]}]}. All [x,y] vertices are absolute normalized 0–1000 image coordinates (x right, y down), NOT coordinates relative to a bounding box. Trace object boundaries with polygons, not broad rectangles. collision: ground footprints of walls, tree trunks (small footprint, NOT entire crown), water, fences, dense bushes. overhead: roofs, crowns, bridge railings. free: door openings and bridge decks that override blocked regions; do not label all grass/path as free because that could erase trunks. Roof and wall footprints must be separate. Infer ground footprints hidden behind roofs/crowns. Include all visible obstacles, even at the edges. Limit to 160 regions with 3–80 vertices each. Use compact polygons, typically 4–12 vertices; do not enumerate decorative pixels. No explanatory text.`;
export function parseMaskInput(value: unknown): MaskInput {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Provide mask settings.");
  const v = value as Record<string,unknown>;
  if (!["cabin","harbour","live"].includes(String(v.source)) || !["image","vision"].includes(String(v.approach))) throw new TypeError("Choose a source and approach.");
  const models = v.approach === "image" ? MAP_MODELS : VISION_MODELS;
  const model = v.model ?? models[0].id;
  if (!models.some(m => m.id === model)) throw new TypeError("Choose a supported model for this approach.");
  if (v.source === "live" && (typeof v.image !== "string" || v.image.length > 8_000_000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(v.image))) throw new TypeError("Provide a bounded generated map image.");
  return { source: v.source as MaskInput["source"], approach: v.approach as Approach, model: model as string, ...(v.source === "live" ? {image:v.image as string} : {}) };
}
export function maskReservation(input: MaskInput) {
  if (input.approach === "image") { const m=MAP_MODELS.find(m=>m.id===input.model)!;return (5000*m.inputPerMillion+4096*m.imagePerMillion)/1e6; }
  const m=VISION_MODELS.find(m=>m.id===input.model)!;return (5000*m.inputPerMillion+16384*m.outputPerMillion)/1e6;
}
