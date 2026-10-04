import { OBJECT_MODELS } from "../objects/generation";
import { objectPalettes, type ObjectPalette } from "../../../lib/objects";

export const CHARACTER_IMAGE_MODELS = OBJECT_MODELS;
export type ImageModel = typeof CHARACTER_IMAGE_MODELS[number]["id"];
export const CHARACTER_PALETTES = objectPalettes;
export type ImageInput = { description: string; model: ImageModel; referenceId?: string };
export type FrameMeasure = { pixels: number; width: number; height: number; bottom: number };
export type ImageCharacter = {
  id: string; parentId?: string; description: string; model: ImageModel;
  sheet: string; raw: string; reference: string; frameWidth: number; frameHeight: number;
  frames: FrameMeasure[]; durationMs: number; estimatedCostUsd: number;
  calls: { stage: string; durationMs: number; estimatedCostUsd: number }[];
  generatedAt: string;
};
export type ImageGeneration = { character: ImageCharacter; rate: { used: number; limit: number }; };
export type CharacterPalette = ObjectPalette;
export function parseImageInput(value: unknown): ImageInput {
  if (value === null || typeof value !== "object") throw new TypeError("Provide character settings.");
  const v = value as Record<string, unknown>;
  if (typeof v.description !== "string" || v.description.trim() === "" || v.description.trim().length > 2000) throw new TypeError("Describe a character or an edit in 1–2000 characters.");
  const model = v.model ?? CHARACTER_IMAGE_MODELS[0].id;
  if (!CHARACTER_IMAGE_MODELS.some(entry => entry.id === model)) throw new TypeError("Choose a supported image model.");
  if (v.referenceId !== undefined && (typeof v.referenceId !== "string" || !/^[a-f0-9]{32}$/.test(v.referenceId))) throw new TypeError("Choose a retained character variant.");
  return { description: v.description.trim(), model: model as ImageModel, ...(v.referenceId !== undefined ? { referenceId: v.referenceId as string } : {}) };
}
