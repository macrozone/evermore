import { NextResponse } from "next/server";
import { parseCharacterInput } from "../../../lab/character/specification";
import { generateCharacter } from "./generate";

export const runtime = "nodejs";
export async function POST(request: Request) {
  let input;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new TypeError("Provide a character description.");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 12_000) { await reader.cancel(); return NextResponse.json({ error: "Character description is too large." }, { status: 413 }); }
      chunks.push(value);
    }
    input = parseCharacterInput(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch {
    return NextResponse.json({ error: "Provide a description (1–2000 characters) and a supported model." }, { status: 400 });
  }
  return NextResponse.json(await generateCharacter(input), { headers: { "Cache-Control": "no-store" } });
}
