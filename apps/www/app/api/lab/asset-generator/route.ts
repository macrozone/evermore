import { NextResponse } from "next/server";
import { parseAssetInput } from "../../../lab/asset-generator/generation";
import { assetGenerator, AssetLimitError, AssetProviderError } from "./generate";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };
function deny(request: Request) {
  const url = new URL(request.url);
  // Next normalizes Request.url to localhost; Host retains the browser's loopback address.
  const host = request.headers.get("host") ?? url.host;
  let browserUrl: URL;
  try { browserUrl = new URL(`${url.protocol}//${host}`); }
  catch { return NextResponse.json({ error: "Invalid local host." }, { status: 403, headers: noStore }); }
  const local = (hostname: string) => ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  const origin = request.headers.get("origin");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const site = request.headers.get("sec-fetch-site");
  if (process.env.NODE_ENV !== "development" || !local(url.hostname) || !local(browserUrl.hostname)
    || browserUrl.host !== host || browserUrl.port !== url.port || browserUrl.username !== "" || browserUrl.password !== ""
    || request.headers.has("forwarded") || (forwardedHost !== null && forwardedHost !== host)
    || (origin !== null && origin !== browserUrl.origin) || (request.method === "POST" && origin !== browserUrl.origin)
    || (site !== null && !["same-origin", "none"].includes(site))) {
    return NextResponse.json({ error: "Live assets are available only in local development from the same origin." }, { status: 403, headers: noStore });
  }
}
export async function GET(request: Request) {
  const rejected = deny(request);
  if (rejected) return rejected;
  return NextResponse.json({ rate: assetGenerator.rate() }, { headers: noStore });
}
export async function POST(request: Request) {
  const rejected = deny(request);
  if (rejected) return rejected;
  let input;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new TypeError("Provide asset settings.");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 8192) { await reader.cancel(); return NextResponse.json({ error: "Asset settings are too large." }, { status: 413, headers: noStore }); }
      chunks.push(value);
    }
    input = parseAssetInput(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch (error) {
    return NextResponse.json({ error: error instanceof TypeError ? error.message : "Provide valid JSON asset settings." }, { status: 400, headers: noStore });
  }
  try {
    const result = input.action === "infer" ? await assetGenerator.infer(input) : await assetGenerator.generate(input);
    return NextResponse.json({ ...result, rate: assetGenerator.rate() }, { headers: noStore });
  } catch (error) {
    const status = error instanceof AssetLimitError ? 429 : 502;
    const rate = assetGenerator.rate();
    return NextResponse.json({ error: error instanceof AssetLimitError || error instanceof AssetProviderError ? error.message : "Asset generation failed. Try again.", rate },
      { status, headers: { ...noStore, ...(status === 429 ? { "Retry-After": String(Math.max(1, Math.ceil((rate.resetsAt - Date.now()) / 1000))) } : {}) } });
  }
}
