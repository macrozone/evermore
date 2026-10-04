import { NextResponse } from "next/server";
import { deny } from "../g3-map/local-access";
import { parseChunkInput } from "../../../lab/m1-outpaint/generation";
import { chunkGenerator } from "./generate";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) { const rejected = deny(request); if (rejected)
    return rejected; return NextResponse.json({ budget: chunkGenerator.budget() }, { headers }); }
export async function POST(request: Request) {
    const rejected = deny(request);
    if (rejected)
        return rejected;
    let input;
    try {
        const reader = request.body?.getReader();
        if (!reader)
            throw new TypeError("Provide chunk settings.");
        let size = 0;
        const chunks: Uint8Array[] = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            size += value.byteLength;
            if (size > 8010000) {
                await reader.cancel();
                return NextResponse.json({ error: "Source is too large." }, { status: 413, headers });
            }
            chunks.push(value);
        }
        input = parseChunkInput(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    }
    catch (error) {
        return NextResponse.json({ error: error instanceof TypeError ? error.message : "Invalid chunk settings." }, { status: 400, headers });
    }
    try {
        return NextResponse.json(await chunkGenerator.generate(input), { headers });
    }
    catch (error) {
        console.error(error);
        // Stable tags survive development hot reload while the global generator retains its cache.
        const code=error instanceof Error && "code" in error ? error.code : undefined;
        const known=error instanceof Error && (code==="map_limit"||code==="map_provider");
        return NextResponse.json({ error: known ? error.message : "Chunk generation failed.", budget: chunkGenerator.budget() }, { status: code==="map_limit" ? 429 : 502, headers });
    }
}
