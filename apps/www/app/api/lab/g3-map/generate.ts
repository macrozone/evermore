import "server-only";
import { GoogleAuth } from "google-auth-library";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { MAP_MODELS, MAP_STYLE, MAX_OUTPUT_TOKENS, reservationUsd, type MapInput, type GeneratedMap, type MapGeneration } from "../../../lab/g3-map/generation";

export class MapLimitError extends Error {}
export class MapProviderError extends Error {}
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
type Payload = { candidates?: { content?: { parts?: { inlineData?: { data: string; mimeType: string } }[] } }[]; usageMetadata?: { promptTokenCount?: number; thoughtsTokenCount?: number; candidatesTokensDetails?: { modality: string; tokenCount: number }[] } };
export async function callVertex(input: MapInput, reference?: { bytes: Buffer; instruction: string }) {
  if (process.env.NODE_ENV !== "development") throw new MapProviderError("Live maps require local development.");
  const project = process.env.GOOGLE_CLOUD_PROJECT ?? "maw-evermore";
  if (!/^[a-z][a-z0-9-]+$/.test(project)) throw new MapProviderError("Invalid Vertex project configuration.");
  let headers: Headers, timer: ReturnType<typeof setTimeout> | undefined;
  try {
    headers = new Headers(await Promise.race([auth.getRequestHeaders(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 10_000); })]));
  } catch { throw new MapProviderError("Vertex credentials unavailable. Run gcloud auth application-default login locally."); }
  finally { clearTimeout(timer); }
  headers.set("Content-Type", "application/json"); headers.set("x-goog-user-project", project);
  let response: Response;
  try {
    response = await fetch(`https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${input.model}:generateContent`, {
      method: "POST", headers, cache: "no-store", signal: AbortSignal.timeout(90_000),
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: reference?.instruction ?? `${MAP_STYLE}\nMap description: ${JSON.stringify(input.prompt)}` }, ...(reference ? [{ inlineData: { mimeType: "image/png", data: reference.bytes.toString("base64") } }] : [])] }], generationConfig: { seed: input.seed, maxOutputTokens: MAX_OUTPUT_TOKENS, responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1", imageSize: "1K" } } }),
    });
  } catch { throw new MapProviderError("Vertex timed out or could not connect. No model fallback was used."); }
  if (!response.ok) { await response.body?.cancel(); throw new MapProviderError(`Vertex returned HTTP ${response.status} for ${input.model}. Check model access; no fallback was used.`); }
  let payload: Payload;
  try { payload = await response.json() as Payload; } catch { throw new MapProviderError("Vertex returned an unreadable response."); }
  const image = payload.candidates?.[0]?.content?.parts?.find(part => part.inlineData)?.inlineData;
  if (!image || !["image/png", "image/jpeg", "image/webp"].includes(image.mimeType) || typeof image.data !== "string" || image.data.length > 8_000_000) throw new MapProviderError("Vertex returned no supported map image (possibly filtered).");
  const model = MAP_MODELS.find(entry => entry.id === input.model)!;
  const usage = payload.usageMetadata;
  const valid = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
  const details = usage?.candidatesTokensDetails;
  const known = valid(usage?.promptTokenCount) && valid(usage?.thoughtsTokenCount) && Array.isArray(details) && details.every(item => valid(item.tokenCount));
  const imageTokens = details?.filter(item => item.modality === "IMAGE").reduce((sum, item) => sum + item.tokenCount, 0);
  const textTokens = details?.filter(item => item.modality === "TEXT").reduce((sum, item) => sum + item.tokenCount, 0) ?? 0;
  const cost = known ? ((usage!.promptTokenCount! * model.inputPerMillion) + ((textTokens + usage!.thoughtsTokenCount!) * model.textPerMillion)) / 1_000_000 + (imageTokens !== undefined && imageTokens > 0 ? imageTokens * model.imagePerMillion / 1_000_000 : model.imageUsd) : model.imageUsd;
  return { bytes: Buffer.from(image.data, "base64"), cost, costBasis: known ? "usage" as const : "image-only" as const };
}

/** Process-wide rolling budget, reserved before auth; failed calls retain their reservation. */
export function createMapGenerator(provider = callVertex, now = Date.now) {
  const cache = new Map<string, GeneratedMap>();
  const pending = new Map<string, Promise<GeneratedMap>>();
  let reservations: { time: number; usd: number }[] = [];
  const budget = () => {
    reservations = reservations.filter(entry => entry.time > now() - 3_600_000);
    return { calls: reservations.length, callLimit: 20, reservedUsd: reservations.reduce((sum, entry) => sum + entry.usd, 0), limitUsd: 1, resetsAt: (reservations[0]?.time ?? now()) + 3_600_000 };
  };
  async function generate(input: MapInput): Promise<MapGeneration> {
    const started = now(), key = createHash("sha256").update(JSON.stringify([MAP_STYLE, MAX_OUTPUT_TOKENS, input])).digest("hex");
    const hit = cache.get(key);
    if (hit) return { map: hit, cached: true, requestCostUsd: 0, durationMs: now() - started, budget: budget() };
    const inFlight = pending.get(key);
    if (inFlight) return { map: await inFlight, cached: true, requestCostUsd: 0, durationMs: now() - started, budget: budget() };
    const current = budget(), reservation = reservationUsd(input);
    if (current.calls >= current.callLimit || current.reservedUsd + reservation > current.limitUsd) throw new MapLimitError("The hourly map budget cannot reserve this request. Reuse cached settings or wait for the rolling window.");
    reservations.push({ time: now(), usd: reservation });
    const work = (async () => {
      const output = await provider(input);
      let image: Buffer, width: number, height: number;
      try {
        const metadata = await sharp(output.bytes, { limitInputPixels: 2048 * 2048 }).metadata();
        if (metadata.width === undefined || metadata.height === undefined || metadata.width > 2048 || metadata.height > 2048) throw new Error("dimensions");
        width = metadata.width; height = metadata.height;
        image = await sharp(output.bytes, { limitInputPixels: 2048 * 2048 }).png().toBuffer();
        if (image.length > 6_000_000) throw new Error("size");
      } catch { throw new MapProviderError("The map image could not be decoded within the 2048 × 2048 pixel limit."); }
      const map: GeneratedMap = { ...input, image: `data:image/png;base64,${image.toString("base64")}`, width, height, durationMs: now() - started, generatedAt: new Date(now()).toISOString(), estimatedCostUsd: output.cost, costBasis: output.costBasis };
      // Eight bounded images: at most ~64 MB of base64 cache per dev process.
      if (cache.size >= 8) cache.delete(cache.keys().next().value!);
      cache.set(key, map);
      return map;
    })().finally(() => pending.delete(key));
    pending.set(key, work);
    const map = await work;
    return { map, cached: false, requestCostUsd: map.estimatedCostUsd, durationMs: now() - started, budget: budget() };
  }
  return { generate, budget };
}
const state = globalThis as typeof globalThis & { g3MapGenerator?: ReturnType<typeof createMapGenerator> };
export const mapGenerator = state.g3MapGenerator ??= createMapGenerator();
