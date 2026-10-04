import { deny } from "./local-access";
import { NextResponse } from "next/server";
import { parseMapInput } from "../../../lab/g3-map/generation";
import { mapGenerator, MapLimitError, MapProviderError } from "./generate";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };

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
