import "server-only";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { GoogleAuth } from "google-auth-library";
import { MAP_MODELS, chunkInstruction, chunkReservation, type ChunkInput } from "../../../lab/m1-outpaint/generation";
import { OVERLAP, type ChunkRecord } from "../../../lab/m1-outpaint/model";
import { callMaskVertex } from "../g3b-map/generate";
import { MapLimitError, MapProviderError } from "../g3-map/generate";
export { MapLimitError, MapProviderError };
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const inline = (bytes: Buffer) => `data:image/png;base64,${bytes.toString("base64")}`;
export async function prepareCanvas(input: ChunkInput) {
    const source = Buffer.from(input.image.split(",")[1]!, "base64");
    let width: number, height: number;
    try {
        const meta = await sharp(source, { limitInputPixels: 2048 * 2048 }).metadata();
        width = meta.width!;
        height = meta.height!;
        if (width === undefined || height === undefined || width === 0 || height === 0 || width < 128 || height < 128 || width > 1536 || height > 1536)
            throw new Error("size");
    }
    catch {
        throw new MapProviderError("Source must be a valid image between 128 and 1536 pixels per side.");
    }
    const horizontal = input.direction === "east" || input.direction === "west", overlap = OVERLAP;
    const boardWidth = width + (horizontal ? overlap : 0), boardHeight = height + (horizontal ? 0 : overlap);
    const crop = { left: input.direction === "east" ? width - overlap : 0, top: input.direction === "south" ? height - overlap : 0, width: horizontal ? overlap : width, height: horizontal ? height : overlap };
    const strip = await sharp(source).extract(crop).png().toBuffer();
    const left = input.direction === "west" ? width : 0, top = input.direction === "north" ? height : 0;
    const board = await sharp({ create: { width: boardWidth, height: boardHeight, channels: 3, background: "#808080" } }).composite([{ input: strip, left, top }]).png().toBuffer();
    return { source, width, height, overlap, boardWidth, boardHeight, board, horizontal };
}
export type Prepared = Awaited<ReturnType<typeof prepareCanvas>>;
export async function callChunkVertex(input: ChunkInput, prepared: Prepared) {
    if (process.env.NODE_ENV !== "development")
        throw new MapProviderError("Live chunks require local development.");
    const project = process.env.GOOGLE_CLOUD_PROJECT ?? "maw-evermore";
    if (!/^[a-z][a-z0-9-]+$/.test(project))
        throw new MapProviderError("Invalid Vertex project.");
    let headers: Headers, timer: ReturnType<typeof setTimeout> | undefined;
    try {
        headers = new Headers(await Promise.race([auth.getRequestHeaders(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 10000); })]));
    }
    catch {
        throw new MapProviderError("Vertex credentials unavailable. Use local ADC.");
    }
    finally {
        clearTimeout(timer);
    }
    headers.set("Content-Type", "application/json");
    headers.set("x-goog-user-project", project);
    const { boardWidth, boardHeight } = prepared;
    const ratio = boardWidth / boardHeight;
    const aspectRatio = (["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"] as const).reduce((best, next) => { const value = (s: string) => { const [a, b] = s.split(":").map(Number); return Math.abs(Math.log(a! / b! / ratio)); }; return value(next) < value(best) ? next : best; });
    let response: Response;
    try {
        response = await fetch(`https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${input.model}:generateContent`, { method: "POST", headers, cache: "no-store", signal: AbortSignal.timeout(120000), body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: chunkInstruction(input.direction, boardWidth, boardHeight, prepared.overlap) }, { inlineData: { mimeType: "image/png", data: prepared.board.toString("base64") } }] }], generationConfig: { maxOutputTokens: 4096, responseModalities: ["IMAGE"], imageConfig: { imageSize: "1K", aspectRatio } } }) });
    }
    catch {
        throw new MapProviderError("Chunk generation timed out or could not connect. No fallback used.");
    }
    if (!response.ok) {
        await response.body?.cancel();
        throw new MapProviderError(`Vertex returned HTTP ${response.status} for ${input.model}. No fallback used.`);
    }
    const payload = await response.json() as {
        candidates?: {
            content?: {
                parts?: {
                    inlineData?: {
                        mimeType: string;
                        data: string;
                    };
                }[];
            };
        }[];
        usageMetadata?: {
            promptTokenCount?: number;
            thoughtsTokenCount?: number;
        };
    };
    const image = payload.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData;
    if (!image || !["image/png", "image/jpeg", "image/webp"].includes(image.mimeType) || image.data.length > 8000000)
        throw new MapProviderError("No supported outpainted image returned.");
    const m = MAP_MODELS.find(m => m.id === input.model)!;
    const usage = payload.usageMetadata, known = typeof usage?.promptTokenCount === "number" && Number.isFinite(usage.promptTokenCount) && usage.promptTokenCount >= 0;
    const cost = m.imageUsd + (known ? (usage!.promptTokenCount! * m.inputPerMillion + (usage?.thoughtsTokenCount ?? 0) * m.textPerMillion) / 1e6 : 0);
    return { bytes: Buffer.from(image.data, "base64"), cost };
}
export async function cutOutput(bytes: Buffer, prepared: Prepared, direction: ChunkInput["direction"]) {
    const { width, height, boardWidth, boardHeight, overlap, horizontal } = prepared;
    let outputWidth: number, outputHeight: number, board: Buffer;
    try {
        const meta = await sharp(bytes, { limitInputPixels: 2048 * 2048 }).metadata();
        outputWidth = meta.width!;
        outputHeight = meta.height!;
        if (outputWidth === undefined || outputHeight === undefined || outputWidth === 0 || outputHeight === 0 || Math.abs(Math.log(outputWidth / outputHeight / (boardWidth / boardHeight))) > .18)
            throw new Error("aspect");
        board = await sharp(bytes).resize(boardWidth, boardHeight, { fit: "fill", kernel: "nearest" }).removeAlpha().png().toBuffer();
    }
    catch {
        throw new MapProviderError("Outpainting returned incompatible dimensions.");
    }
    const image = await sharp(board).extract({ left: direction === "east" ? overlap : 0, top: direction === "south" ? overlap : 0, width, height }).png().toBuffer();
    const context = await sharp(board).extract({ left: direction === "west" ? width : 0, top: direction === "north" ? height : 0, width: horizontal ? overlap : width, height: horizontal ? height : overlap }).png().toBuffer();
    return { image, context, outputWidth, outputHeight };
}
export function createChunkGenerator(provider = callChunkVertex, maskProvider = callMaskVertex, now = Date.now) {
    const imageCache = new Map<string, {
        generated: {
            bytes: Buffer;
            cost: number;
        };
        cut: Awaited<ReturnType<typeof cutOutput>>;
        durationMs: number;
    }>();
    const cache = new Map<string, ChunkRecord>(), pending = new Map<string, Promise<ChunkRecord>>();
    let reservations: {
        time: number;
        usd: number;
    }[] = [];
    const budget = () => { reservations = reservations.filter(r => r.time > now() - 3600000); return { calls: reservations.length, callLimit: 8, reservedUsd: reservations.reduce((s, r) => s + r.usd, 0), limitUsd: 3, resetsAt: (reservations[0]?.time ?? now()) + 3600000 }; };
    async function generate(input: ChunkInput) {
        const started = now(), prepared = await prepareCanvas(input);
        const imageKey = createHash("sha256").update(prepared.source).update(JSON.stringify([input.direction, input.model, "m1-outpaint-v3-strip-percent"])).digest("hex");
        const key = createHash("sha256").update(imageKey).update(input.maskModel).digest("hex");
        let chargedUsd = 0;
        const wrap = (chunk: ChunkRecord, cached: boolean) => ({ chunk, cached, requestCostUsd: cached ? 0 : chargedUsd, durationMs: now() - started, budget: budget() });
        const hit = cache.get(key);
        if (hit)
            return wrap(hit, true);
        const active = pending.get(key);
        if (active)
            return wrap(await active, true);
        const b = budget(), usd = chunkReservation(input);
        if (b.calls >= b.callLimit || b.reservedUsd + usd > b.limitUsd)
            throw new MapLimitError("Hourly chunk reservation exhausted. Use saved chunks or wait.");
        reservations.push({ time: now(), usd });
        const work = (async () => {
            let stage = imageCache.get(imageKey);
            const imageReused = stage !== undefined;
            if (!stage) {
                const imageStarted=now();
                const generated = await provider(input, prepared), cut = await cutOutput(generated.bytes, prepared, input.direction);
                stage = { generated, cut, durationMs:now()-imageStarted };
                if (imageCache.size >= 8)
                    imageCache.delete(imageCache.keys().next().value!);
                imageCache.set(imageKey, stage);
            }
            const { generated, cut } = stage, maskStarted = now();
            const masks = await maskProvider({ source: "live", image: inline(cut.image), approach: "vision", model: input.maskModel }, { bytes: cut.image, width: prepared.width, height: prepared.height });
            chargedUsd = masks.estimatedCostUsd + (imageReused ? 0 : generated.cost);
            const result: ChunkRecord = { version: 1, direction: input.direction, width: prepared.width, height: prepared.height, overlap: prepared.overlap, image: inline(cut.image), context: inline(cut.context), masks: { ...masks, durationMs: now() - maskStarted, generatedAt: new Date(now()).toISOString() }, model: input.model, durationMs: stage.durationMs + now() - maskStarted, estimatedCostUsd: generated.cost + masks.estimatedCostUsd, imageCostUsd: generated.cost, maskCostUsd: masks.estimatedCostUsd, generatedAt: new Date(now()).toISOString(), outputWidth: cut.outputWidth, outputHeight: cut.outputHeight };
            if (cache.size >= 8)
                cache.delete(cache.keys().next().value!);
            cache.set(key, result);
            return result;
        })().finally(() => pending.delete(key));
        pending.set(key, work);
        return wrap(await work, false);
    }
    return { generate, budget };
}
const state = globalThis as typeof globalThis & {
    m1ChunkGenerator?: ReturnType<typeof createChunkGenerator>;
};
export const chunkGenerator = state.m1ChunkGenerator ??= createChunkGenerator();
