import { z } from "zod";
import { OBJECT_MODELS } from "../objects/generation";

export { OBJECT_MODELS as IMAGE_MODELS };
export const TEXT_MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash"] as const;
export const STRATEGIES = ["independent", "reference", "procedural"] as const;
/** Technical use, never a taxonomy of subjects. One tile is 16 scene pixels. */
export const AssetRoleSchema = z.object({
  role: z.enum(["surface", "object", "strip"]).describe("surface: opaque ground repeating XY; object: isolated transparent sprite; strip: transparent fence/wall repeating X"),
  widthTiles: z.number().int().min(1).max(8),
  heightTiles: z.number().int().min(1).max(8),
  anchorX: z.number().min(0).max(1).describe("Normalized ground anchor within the sprite"),
  anchorY: z.number().min(0).max(1),
  explanation: z.string().min(1).max(500),
});
export type AssetRole = z.infer<typeof AssetRoleSchema>;
export const AssetInputSchema = z.object({
  action: z.enum(["infer", "generate"]),
  description: z.string().trim().min(1).max(500),
  seed: z.number().int().min(0).max(2_147_483_637).default(1),
  imageModel: z.enum(OBJECT_MODELS.map(m => m.id)).default(OBJECT_MODELS[0].id),
  textModel: z.enum(TEXT_MODELS).default(TEXT_MODELS[0]),
  strategy: z.enum(STRATEGIES).default("independent"),
  override: AssetRoleSchema.optional(),
});
export type AssetInput = z.infer<typeof AssetInputSchema>;
export type RoleInference = { parameters: AssetRole; model: string; durationMs: number; estimatedCostUsd: number; usage: { inputTokens: number; outputTokens: number } };
export type AssetVariant = {
  index: number; seed: number; sprite: string; raw: string; width: number; height: number;
  durationMs: number; estimatedCostUsd: number; source: "model" | "procedural";
  seamError: { horizontal: number; vertical: number };
};
export type AssetBatch = {
  description: string; seed: number; imageModel: string; strategy: AssetInput["strategy"];
  inference: RoleInference; parameters: AssetRole; overridden: boolean;
  variants: AssetVariant[]; errors: { index: number; error: string }[];
  durationMs: number; estimatedCostUsd: number; cached: boolean; recordedAt?: string;
};
export function parseAssetInput(value: unknown): AssetInput {
  const parsed = AssetInputSchema.safeParse(value);
  if (!parsed.success) throw new TypeError("Provide a description (1–500 characters), an integer seed (0–2147483637), supported models and valid technical parameters.");
  return parsed.data;
}
export const ASSET_STYLE = "Cozy SNES-inspired RPG pixel art, matching Evermore moodboard 02-eigene-welt it2: warm terracotta, cream, brown timber, muted sage foliage, crisp readable pixel clusters, light from upper left. Axis-aligned orthographic top-down view looking from the south, like Stardew Valley / Secret of Mana. Horizontal and vertical edges, never 45-degree isometric. No text, labels, collage or scene.";
export function assetPrompt(input: AssetInput, role: AssetRole, index: number, reference: boolean) {
  const technical = role.role === "surface"
    ? "Opaque ground texture, full bleed, uniform scale and light, seamless repeat in both axes. No isolated objects, horizon, frame or margin."
    : role.role === "strip"
      ? "One straight horizontal modular wall/fence segment. Repeat left/right; matching end height and material. Flat pure magenta #ff00ff background, no ground or cast shadow."
      : "Exactly one isolated complete object, centered with empty margin on flat pure magenta #ff00ff background, no ground or cast shadow. Avoid magenta in the subject.";
  return `${ASSET_STYLE}\nSubject (description only): ${JSON.stringify(input.description)}\n${technical}\nTarget: ${role.widthTiles * 16} by ${role.heightTiles * 16} scene pixels. Ground anchor ${role.anchorX}, ${role.anchorY}.\nFamily variant ${index + 1} of 10: change small material details, silhouette and decoration; keep camera, scale, subject and palette consistent.${reference ? " The attached image is the BASE ASSET: create a modest new variant of that subject, not a copy; keep its style and camera." : ""}`;
}
