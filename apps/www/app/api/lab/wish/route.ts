import { parseWishInput } from "../../../lab/wish/model";
import { estimateWish } from "./generate";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const origin = request.headers.get("Origin");
  const expectedOrigin = new URL(request.url);
  // Next dev can canonicalise the URL to localhost even when the browser uses
  // 127.0.0.1. The incoming Host is the authority actually visited.
  expectedOrigin.host = request.headers.get("Host") ?? expectedOrigin.host;
  if (origin !== null && origin !== expectedOrigin.origin) return Response.json({ error: "Use this experiment from the same origin." }, { status: 403, headers });
  let input;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new TypeError("Missing wish.");
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 16000) { await reader.cancel(); return Response.json({ error: "Wish is too large." }, { status: 413, headers }); }
      chunks.push(value);
    }
    input = parseWishInput(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch { return Response.json({ error: "Provide a wish (1–2000 characters), place (1–300), influence 0–1, whole inspiration 0–5000 and a supported model/mode." }, { status: 400, headers }); }
  return Response.json(await estimateWish(input), { headers });
}
