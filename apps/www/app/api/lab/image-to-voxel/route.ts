import { join } from "node:path";
import { generateHeightMaps } from "../../../../lib/heightmap-assets.mjs";
import { HEIGHT_MODELS } from "../../../../lib/heightmap-config.mjs";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };
type Maps = Awaited<ReturnType<typeof generateHeightMaps>>;
const state = globalThis as typeof globalThis & { heightmapLab?: { calls: number[]; pending: Map<string, Promise<Maps>>; cache: Map<string, Maps> } };
const budget = state.heightmapLab ??= { calls: [], pending: new Map<string, Promise<Maps>>(), cache: new Map<string, Maps>() };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: noStore });
export async function POST(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  let browser: URL;
  try { browser = new URL(`${url.protocol}//${host}`); } catch { return json({ error: "Invalid local host." }, 403); }
  const local = (hostname: string) => ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  if (process.env.NODE_ENV !== "development" || !local(url.hostname) || !local(browser.hostname)
    || browser.host !== host || browser.port !== url.port || browser.username !== "" || browser.password !== ""
    || request.headers.has("forwarded") || (request.headers.has("x-forwarded-host") && request.headers.get("x-forwarded-host") !== host)
    || request.headers.get("origin") !== browser.origin
    || (request.headers.has("sec-fetch-site") && !["same-origin", "none"].includes(request.headers.get("sec-fetch-site")!))) return json({ error: "Generation is available only in local development from the same origin." }, 403);
  let input: { source: string; model: string; seed: number };
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Provide generation settings.");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 1024) { await reader.cancel(); return json({ error: "Settings are too large." }, 413); }
      chunks.push(value);
    }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (parsed === null || typeof parsed !== "object") throw new Error("Provide generation settings.");
    input = parsed as typeof input;
    if (!["cabin", "harbour"].includes(input.source) || !HEIGHT_MODELS.some(model => model.id === input.model)
      || !Number.isInteger(input.seed) || input.seed < 0 || input.seed > 2147483647) throw new Error("Choose a supported source, model and integer seed.");
  } catch { return json({ error: "Choose valid generation settings." }, 400); }
  const key = JSON.stringify([input.source, input.model, input.seed]);
  let work = budget.pending.get(key);
  const hit = budget.cache.get(key);
  if (!hit && !work) {
    budget.calls = budget.calls.filter(time => time > Date.now() - 3600000);
    if (budget.calls.length >= 6) return json({ error: "Six map-pair attempts per hour are allowed. Reuse cached settings or wait." }, 429);
    budget.calls.push(Date.now());
    work = generateHeightMaps({ ...input, publicDir: join(process.cwd(), "public") }).then(result => {
      if (budget.cache.size >= 3) budget.cache.delete(budget.cache.keys().next().value!);
      budget.cache.set(key, result); return result;
    }).finally(() => budget.pending.delete(key));
    budget.pending.set(key, work);
  }
  try {
    const result = hit ?? await work!;
    return json({ heightmap: `data:image/png;base64,${result.heightmap.toString("base64")}`, facade: `data:image/png;base64,${result.facade.toString("base64")}`, metadata: result.metadata, cached: hit !== undefined });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Map generation failed." }, 502); }
}
