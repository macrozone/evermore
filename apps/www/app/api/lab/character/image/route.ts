import { NextResponse } from "next/server";
import { parseImageInput } from "../../../../lab/character/image-specification";
import { characterImageGenerator, CharacterImageError } from "./generate";

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
    return NextResponse.json({ error: "Live image characters are available only in local development from the same origin." }, { status: 403, headers: noStore });
  }
}
export async function POST(request: Request) {
  const rejected = deny(request);
  if (rejected) return rejected;
  let input;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new TypeError("Provide character settings.");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 12_000) { await reader.cancel(); return NextResponse.json({ error: "Character settings are too large." }, { status: 413, headers: noStore }); }
      chunks.push(value);
    }
    input = parseImageInput(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch (error) { return NextResponse.json({ error: error instanceof TypeError ? error.message : "Provide valid character settings." }, { status: 400, headers: noStore }); }
  try { return NextResponse.json(await characterImageGenerator.generate(input), { headers: noStore }); }
  catch (error) {
    const failure = error instanceof CharacterImageError ? error : new CharacterImageError("Character generation failed.");
    return NextResponse.json({ error: failure.message, calls: failure.calls, rate: characterImageGenerator.rate() }, { status: failure.status, headers: noStore });
  }
}

