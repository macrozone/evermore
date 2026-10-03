import { NextResponse } from "next/server";
import { parseObjectInput } from "../../../lab/objects/generation";
import { objectGenerator, ObjectLimitError } from "./generate";

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
    return NextResponse.json({ error: "Live objects are available only in local development from the same origin." }, { status: 403, headers: noStore });
  }
}
export async function GET(request: Request) {
  const rejected = deny(request);
  if (rejected) return rejected;
  return NextResponse.json({ rate: objectGenerator.rate() }, { headers: noStore });
}
export async function POST(request: Request) {
  const rejected = deny(request);
  if (rejected) return rejected;
  let input;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new TypeError("Provide object settings.");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 8_192) { await reader.cancel(); return NextResponse.json({ error: "Object settings are too large." }, { status: 413, headers: noStore }); }
      chunks.push(value);
    }
    input = parseObjectInput(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch (error) {
    return NextResponse.json({ error: error instanceof TypeError ? error.message : "Provide valid JSON object settings." }, { status: 400, headers: noStore });
  }
  try { return NextResponse.json(await objectGenerator.generate(input), { headers: noStore }); }
  catch (error) {
    if (error instanceof ObjectLimitError) {
      const rate = objectGenerator.rate();
      return NextResponse.json({ error: error.message, rate }, { status: 429, headers: { ...noStore, "Retry-After": String(Math.max(1, Math.ceil((rate.resetsAt - Date.now()) / 1000))) } });
    }
    return NextResponse.json({ error: "Object generation failed. Try again." }, { status: 502, headers: noStore });
  }
}
