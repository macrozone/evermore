import { NextResponse } from "next/server";
import { parseBookInput } from "../../../lab/book/generation";
import { generateBook } from "./generate";

export const runtime = "nodejs";
export async function POST(request: Request) {
  let input;
  try {
    // Bound the stream, including requests without a Content-Length header.
    const reader = request.body?.getReader();
    if (!reader) throw new TypeError("Provide book answers.");
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 40_000) { await reader.cancel(); return NextResponse.json({ error: "Book answers are too large." }, { status: 413 }); }
      chunks.push(value);
    }
    input = parseBookInput(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch {
    return NextResponse.json({ error: "Provide two answers (1–4000 characters each) and a supported model." }, { status: 400 });
  }
  return NextResponse.json(await generateBook(input), { headers: { "Cache-Control": "no-store" } });
}
