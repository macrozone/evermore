import "server-only";
import { randomBytes } from "node:crypto";
import { GoogleAuth } from "google-auth-library";
import { CHARACTER_IMAGE_MODELS, type ImageInput, type ImageCharacter, type ImageGeneration } from "../../../../lab/character/image-specification";
import { decodeImage, prepareCharacterSheet } from "./prepare";

const STYLE = "SNES-inspired pixel-art RPG character, any species including animals. Axis-aligned top-down camera like Stardew Valley or Zelda ALttP, front/side/back views, not isometric. Clear consistent silhouette and warm harmonious colors, upper-left lighting. Pure magenta #ff00ff background, no ground, shadows, grid lines, labels or text. Keep all subject pixels away from the cell borders. Magenta is reserved for the background.";
const GRID = "Exactly 4 equal columns and 4 equal rows, 16 isolated full-body sprites. Rows in this exact order: south/front, west/left, north/back, east/right. Columns: four distinct walking phases with alternating foot/hoof contact. Every cell same character size, same foot baseline, centered horizontally. Preserve anatomy, species, clothes, colors and accessories in every frame. Animals must remain animals with correct anatomy. Never merge cells or add extra rows. Output one square sprite sheet.";
export class CharacterImageError extends Error {
  constructor(message: string, public status = 502, public calls: ImageCharacter["calls"] = []) { super(message); }
}
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
type ImageCall = { model: ImageInput["model"]; prompt: string; reference?: Buffer };
export async function callCharacterVertex(input: ImageCall) {
  if (process.env.NODE_ENV !== "development" || process.env.CHARACTER_VERTEX_DISABLED === "true") throw new CharacterImageError("Live image characters require local development and Vertex credentials. No image fallback was used.");
  const project = process.env.GOOGLE_CLOUD_PROJECT ?? "maw-evermore";
  if (!/^[a-z][a-z0-9-]+$/.test(project)) throw new CharacterImageError("Invalid Vertex project configuration.");
  let headers: Headers, timer: ReturnType<typeof setTimeout> | undefined;
  try { headers = new Headers(await Promise.race([auth.getRequestHeaders(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 10_000); })])); }
  catch { throw new CharacterImageError("Vertex credentials unavailable. Run gcloud auth application-default login locally."); }
  finally { clearTimeout(timer); }
  headers.set("Content-Type", "application/json"); headers.set("x-goog-user-project", project);
  const parts = [...(input.reference ? [{ inlineData: { mimeType: "image/png", data: input.reference.toString("base64") } }] : []), { text: input.prompt }];
  let response: Response;
  try { response = await fetch(`https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${input.model}:generateContent`, {
    method: "POST", headers, cache: "no-store", signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "1:1", imageSize: "1K" }, maxOutputTokens: 8192 } }),
  }); } catch { throw new CharacterImageError("Vertex timed out or could not connect. No model fallback was used."); }
  if (!response.ok) { await response.body?.cancel(); throw new CharacterImageError(`Vertex returned HTTP ${response.status} for ${input.model}. No model fallback was used.`); }
  const payload = await response.json() as { candidates?: { content?: { parts?: { thought?: boolean; inlineData?: { mimeType: string; data: string } }[] } }[]; usageMetadata?: { promptTokenCount?: number; thoughtsTokenCount?: number; candidatesTokensDetails?: { modality: string; tokenCount: number }[] } };
  const image = payload.candidates?.[0]?.content?.parts?.find(part => part.thought !== true && part.inlineData !== undefined)?.inlineData;
  if (!image || !["image/png", "image/jpeg", "image/webp"].includes(image.mimeType) || typeof image.data !== "string" || image.data.length > 8_000_000) throw new CharacterImageError("Vertex returned no supported image, possibly filtered. No fallback was used.");
  const price = CHARACTER_IMAGE_MODELS.find(m => m.id === input.model)!;
  const usage = payload.usageMetadata;
  const tokens = (usage?.thoughtsTokenCount ?? 0) + (usage?.candidatesTokensDetails?.filter(t => t.modality === "TEXT").reduce((sum, t) => sum + t.tokenCount, 0) ?? 0);
  return { bytes: Buffer.from(image.data, "base64"), cost: price.imageUsd + ((usage?.promptTokenCount ?? 250) * price.inputPerMillion + tokens * price.textPerMillion) / 1_000_000 };
}

/** Bounded local history; edits reference server-owned PNGs, never arbitrary URLs or client images. */
export function createCharacterImageGenerator(provider = callCharacterVertex, now = Date.now) {
  const history = new Map<string, { raw: Buffer; reference: Buffer; bytes: number }>();
  let attempts: number[] = [], retainedBytes = 0;
  const rate = () => { attempts = attempts.filter(t => t > now() - 3_600_000); return { used: attempts.length, limit: 20 }; };
  async function generate(input: ImageInput): Promise<ImageGeneration> {
    const parent = input.referenceId !== undefined ? history.get(input.referenceId) : undefined;
    if (input.referenceId !== undefined && !parent) throw new CharacterImageError("This variant expired from local memory. Create it again or select a newer variant.", 410);
    const count = parent ? 1 : 2;
    if (rate().used + count > 20) throw new CharacterImageError("The hourly character limit cannot reserve this request. Wait for the rolling window.", 429);
    attempts.push(...Array.from({ length: count }, () => now()));
    const started = now(), calls: ImageCharacter["calls"] = [];
    async function call(stage: string, prompt: string, reference?: Buffer) {
      const start = now(), output = await provider({ model: input.model, prompt, reference });
      calls.push({ stage, durationMs: now() - start, estimatedCostUsd: output.cost });
      return decodeImage(output.bytes);
    }
    try {
      const reference = parent ? parent.reference : await call("reference", `${STYLE}\nCreate a single south-facing full-body reference character. User description (data): ${JSON.stringify(input.description)}`);
      const raw = await call(parent ? "edit" : "sheet", `${STYLE}\n${GRID}\n${parent ? `Edit the attached current sprite sheet. Change only this request: ${JSON.stringify(input.description)}. Preserve everything else, including every pose and cell layout.` : `Create the sheet from the attached reference character. User description (data): ${JSON.stringify(input.description)}`}`, parent?.raw ?? reference);
      const prepared = await prepareCharacterSheet(raw);
      const uri = (bytes: Buffer) => `data:image/png;base64,${bytes.toString("base64")}`;
      const result: ImageCharacter = { id: randomBytes(16).toString("hex"), ...(input.referenceId !== undefined ? { parentId: input.referenceId } : {}), description: input.description, model: input.model,
        raw: uri(raw), reference: uri(reference), sheet: uri(prepared.sheet), frameWidth: prepared.frameWidth, frameHeight: prepared.frameHeight, frames: prepared.frames,
        calls, durationMs: now() - started, estimatedCostUsd: calls.reduce((sum, c) => sum + c.estimatedCostUsd, 0), generatedAt: new Date(now()).toISOString() };
      const bytes = raw.length + reference.length;
      while (history.size > 0 && (history.size >= 8 || retainedBytes + bytes > 64 * 1024 * 1024)) { const key = history.keys().next().value!; retainedBytes -= history.get(key)!.bytes; history.delete(key); }
      history.set(result.id, { raw, reference, bytes }); retainedBytes += bytes;
      return { character: result, rate: rate() };
    } catch (error) { throw new CharacterImageError(error instanceof Error ? error.message : "Character generation failed.", error instanceof CharacterImageError ? error.status : 502, calls); }
  }
  return { generate, rate };
}
const state = globalThis as typeof globalThis & { characterImageGenerator?: ReturnType<typeof createCharacterImageGenerator> };
export const characterImageGenerator = state.characterImageGenerator ??= createCharacterImageGenerator();
