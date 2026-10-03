import "server-only";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { GoogleAuth } from "google-auth-library";
import { OBJECT_PIPELINE_VERSION, OBJECT_STYLE, loadObjectStyleReference, prepareObjectSprite } from "../../../../lib/object-assets.mjs";
import { objectPalettes } from "../../../../lib/objects";
import { estimateObject, OBJECT_MODELS, type GeneratedObject, type ObjectGeneration, type ObjectInput } from "../../../lab/objects/generation";

const HOUR = 3_600_000;
const LIMIT = 20;
const MAX_CACHE_BYTES = 32 * 1024 * 1024;
export class ObjectLimitError extends Error {}
export class ObjectProviderError extends Error {}
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
function deadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new ObjectProviderError("Credential lookup timed out. Check local ADC.")), ms); })]).finally(() => clearTimeout(timer));
}

type Payload = {
  candidates?: { content?: { parts?: { inlineData?: { data: string; mimeType: string } }[] } }[];
  usageMetadata?: { promptTokenCount?: number; thoughtsTokenCount?: number; candidatesTokensDetails?: { modality: string; tokenCount: number }[] };
};
async function callVertex(input: ObjectInput): Promise<{ bytes: Buffer; mime: string; cost: number }> {
  if (process.env.NODE_ENV !== "development") throw new ObjectProviderError("Live objects are available only in local development.");
  const project = process.env.GOOGLE_CLOUD_PROJECT ?? "maw-evermore";
  if (!/^[a-z][a-z0-9-]+$/.test(project)) throw new ObjectProviderError("Invalid Vertex project configuration.");
  let headers: Headers;
  try { headers = new Headers(await deadline(auth.getRequestHeaders(), 10_000)); }
  catch { throw new ObjectProviderError("Vertex credentials unavailable. Run gcloud auth application-default login locally."); }
  headers.set("Content-Type", "application/json");
  headers.set("x-goog-user-project", project);
  let reference;
  try { reference = await loadObjectStyleReference(join(process.cwd(), "public")); }
  catch { throw new ObjectProviderError("The library style reference is unavailable. Check the local public assets."); }
  let response: Response;
  try {
    response = await fetch(`https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${input.model}:generateContent`, {
      method: "POST", headers, cache: "no-store", signal: AbortSignal.timeout(90_000),
      body: JSON.stringify({ contents: [{ role: "user", parts: [reference, { text: `${OBJECT_STYLE}\nSubject description: ${JSON.stringify(input.prompt)}.\nTarget sprite: ${estimateObject(input).width} × ${estimateObject(input).height} pixels. Keep the library style above.` }] }],
        generationConfig: { seed: input.seed, responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1", imageSize: "1K" } } }),
    });
  } catch { throw new ObjectProviderError("Vertex request timed out or could not connect. No model fallback was used."); }
  if (!response.ok) {
    await response.body?.cancel();
    throw new ObjectProviderError(`Vertex returned HTTP ${response.status} for ${input.model}. Check model access; no fallback was used.`);
  }
  let payload: Payload;
  try { payload = await response.json() as Payload; } catch { throw new ObjectProviderError("Vertex returned an unreadable response."); }
  const image = payload.candidates?.[0]?.content?.parts?.find(part => part.inlineData)?.inlineData;
  if (!image || !["image/png", "image/jpeg", "image/webp"].includes(image.mimeType) || typeof image.data !== "string" || image.data.length > 8_000_000) throw new ObjectProviderError("Vertex returned no supported image (possibly blocked by safety filters).");
  const price = OBJECT_MODELS.find(model => model.id === input.model)!;
  const usage = payload.usageMetadata;
  const textTokens = (usage?.candidatesTokensDetails?.filter(item => item.modality === "TEXT").reduce((sum, item) => sum + item.tokenCount, 0) ?? 0) + (usage?.thoughtsTokenCount ?? 0);
  return { bytes: Buffer.from(image.data, "base64"), mime: image.mimeType,
    cost: price.imageUsd + ((usage?.promptTokenCount ?? 250) * price.inputPerMillion + textTokens * price.textPerMillion) / 1_000_000 };
}

/** One shared budget per development process; reservations prevent concurrent overspend. */
export function createObjectGenerator(provider = callVertex, now = Date.now) {
  const cache = new Map<string, { object: GeneratedObject; bytes: number }>();
  const pending = new Map<string, Promise<GeneratedObject>>();
  let calls: number[] = [], cacheBytes = 0;
  const rate = () => {
    calls = calls.filter(time => time > now() - HOUR);
    return { used: calls.length, limit: LIMIT, resetsAt: (calls[0] ?? now()) + HOUR };
  };
  async function generate(input: ObjectInput): Promise<ObjectGeneration> {
    const started = now();
    const variants = Array.from({ length: input.variants }, (_, index) => {
      const settings = { ...input, seed: input.seed + index, variants: 1 };
      const key = createHash("sha256").update(JSON.stringify([OBJECT_PIPELINE_VERSION, OBJECT_STYLE, settings])).digest("hex");
      return { settings, key, fresh: !cache.has(key) && !pending.has(key) };
    });
    const missing = variants.filter(variant => variant.fresh).length;
    if (rate().used + missing > LIMIT) throw new ObjectLimitError("Not enough image calls remain for these variants. Reuse cached settings or wait for the hourly window.");
    calls.push(...Array.from({ length: missing }, () => now()));
    let cost = 0;
    const results = await Promise.allSettled(variants.map(({ settings, key, fresh }) => {
      const hit = cache.get(key);
      if (hit) { cache.delete(key); cache.set(key, hit); return Promise.resolve(hit.object); }
      if (!fresh) return pending.get(key)!;
      const work = (async () => {
        const start = now();
        const image = await provider(settings);
        cost += image.cost;
        const metadata = estimateObject(settings);
        let sprite: Buffer;
        try { sprite = await prepareObjectSprite(image.bytes, metadata.width, metadata.height, settings.pixelSize, objectPalettes[settings.palette]); }
        catch { throw new ObjectProviderError("The image could not be prepared as a sprite. Try a simpler isolated object."); }
        const object: GeneratedObject = { ...metadata, id: `live-${key.slice(0, 16)}`, name: settings.prompt,
          sprite: `data:image/png;base64,${sprite.toString("base64")}`, raw: `data:${image.mime};base64,${image.bytes.toString("base64")}`,
          prompt: settings.prompt, seed: settings.seed, model: settings.model, durationMs: now() - start, estimatedCostUsd: image.cost,
          generatedAt: new Date(now()).toISOString(), footprintSource: "heuristic", pixelSize: settings.pixelSize, palette: settings.palette };
        const bytes = Buffer.byteLength(JSON.stringify(object));
        while (cache.size > 0 && (cache.size >= 32 || cacheBytes + bytes > MAX_CACHE_BYTES)) {
          const oldest = cache.keys().next().value!;
          cacheBytes -= cache.get(oldest)!.bytes; cache.delete(oldest);
        }
        if (bytes <= MAX_CACHE_BYTES) { cache.set(key, { object, bytes }); cacheBytes += bytes; }
        return object;
      })().finally(() => pending.delete(key));
      pending.set(key, work);
      return work;
    }));
    return { objects: results.flatMap(result => result.status === "fulfilled" ? [result.value] : []),
      errors: results.flatMap((result, index) => result.status === "rejected" ? [{ seed: variants[index]!.settings.seed,
        error: result.reason instanceof ObjectProviderError ? result.reason.message : "Object generation failed. Try again." }] : []),
      durationMs: now() - started, estimatedCostUsd: cost, cached: missing === 0, rate: rate() };
  }
  return { generate, rate };
}
const globalState = globalThis as typeof globalThis & { liveObjectGenerator?: ReturnType<typeof createObjectGenerator> };
export const objectGenerator = globalState.liveObjectGenerator ??= createObjectGenerator();
