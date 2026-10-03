import { imageContentType, readMoodboardImage } from "../../../../../lib/moodboards";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ board: string; file: string }> }) {
  const { board, file } = await params;
  const bytes = await readMoodboardImage(board, file);
  if (!bytes) return new Response("Image not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": imageContentType(file)!,
      "Cache-Control": "public, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
