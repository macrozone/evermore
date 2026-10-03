export const HEIGHT_MODELS: { id: string; label: string; imageUsd: number; inputPerMillion: number; textPerMillion: number }[];
export function generateHeightMaps(input: { publicDir: string; source: string; model: string; seed?: number }): Promise<{
  heightmap: Buffer; facade: Buffer; rawHeight: Buffer;
  metadata: { source: string; model: string; seed: number; width: number; height: number; generatedAt: string; durationMs: number; estimatedCostUsd: number; usage: unknown[]; prompts: { height: string }; normalization: string };
}>;
