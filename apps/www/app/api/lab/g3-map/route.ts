import { NextResponse } from "next/server";
import { parseMapInput } from "../../../lab/g3-map/generation";
import { mapGenerator, MapLimitError, MapProviderError } from "./generate";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };
function deny(request: Request) {
  const url = new URL(request.url), host = request.headers.get("host") ?? url.host;
  let browser: URL;
  try { browser = new URL(`${url.protocol}//${host}`); } catch { return NextResponse.json({ error: "Invalid local host." }, { status: 403, headers: noStore }); }
  const local = (name: string) => ["localhost", "127.0.0.1", "[::1]"].includes(name);
  const origin = request.headers.get("origin"), forwarded = request.headers.get("x-forwarded-host"), site = request.headers.get("sec-fetch-site");
  if (process.env.NODE_ENV !== "development" || !local(url.hostname) || !local(browser.hostname) || browser.host !== host || browser.port !== url.port || browser.username !== "" || browser.password !== "" || request.headers.has("forwarded") || (forwarded !== null && forwarded !== host) || (origin !== null && origin !== browser.origin) || (request.method === "POST" && origin !== browser.origin) || (site !== null && !["same-origin", "none"].includes(site))) return NextResponse.json({ error: "Live maps require local development from the same loopback origin." }, { status: 403, headers: noStore });
}
export async function GET(request: Request) {
  const rejected = deny(request); if (rejected) return rejected;
  return NextResponse.json({ budget: mapGenerator.budget() }, { headers: noStore });
}
export async function POST(request: Request) {
  const rejected = deny(request); if (rejected) return rejected;
  let input;
  try {
    const reader = request.body?.getReader(); if (!reader) throw new TypeError("Provide map settings.");
    const chunks: Uint8Array[] = []; let bytes = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 8192) { await reader.cancel(); return NextResponse.json({ error: "Map settings are too large." }, { status: 413, headers: noStore }); }
      chunks.push(value);
    }
    input = parseMapInput(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch (error) { return NextResponse.json({ error: error instanceof TypeError ? error.message : "Provide valid JSON map settings." }, { status: 400, headers: noStore }); }
  try { return NextResponse.json(await mapGenerator.generate(input), { headers: noStore }); }
  catch (error) {
    const budget = mapGenerator.budget();
    if (error instanceof MapLimitError) return NextResponse.json({ error: error.message, budget }, { status: 429, headers: { ...noStore, "Retry-After": String(Math.max(1, Math.ceil((budget.resetsAt - Date.now()) / 1000))) } });
    return NextResponse.json({ error: error instanceof MapProviderError ? error.message : "Map generation failed. Try again.", budget }, { status: 502, headers: noStore });
  }
}
