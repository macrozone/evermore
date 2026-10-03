import { parseWorldSpecification, type WorldSpecification } from "@evermore/world";

export const LAST_SPEC_KEY = "evermore:lastSpec";
export const DEFAULT_SPEC_SEED = "evermore-g1";
const MAX_BYTES = 64_000;
export interface WorldHandoff { specification: WorldSpecification; seed: string | number }

/** Accept both a raw specification and the book's specification/seed JSON. */
export function parseWorldHandoff(text: string, fallbackSeed: string | number = DEFAULT_SPEC_SEED): WorldHandoff {
  if (text.length > MAX_BYTES) throw new RangeError("World specification is too large.");
  const value: unknown = JSON.parse(text);
  const record = value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
  const specification = parseWorldSpecification("specification" in record ? record.specification : value);
  const seed = "specification" in record && "seed" in record ? record.seed : fallbackSeed;
  if (!(typeof seed === "string" && seed.length <= 200) && !(typeof seed === "number" && Number.isSafeInteger(seed))) {
    throw new TypeError("Seed must be a string or a safe integer.");
  }
  return { specification, seed: seed as string | number };
}

export async function encodeWorldHash(handoff: WorldHandoff): Promise<string> {
  const validated = parseWorldHandoff(JSON.stringify(handoff));
  const stream = new Blob([JSON.stringify(validated)]).stream().pipeThrough(new CompressionStream("deflate"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return `#spec=${btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")}`;
}

export async function decodeWorldHash(hash: string): Promise<WorldHandoff | null> {
  const encoded = new URLSearchParams(hash.replace(/^#/, "")).get("spec");
  if (encoded === null) return null;
  if (encoded.length === 0 || encoded.length > MAX_BYTES || !/^[\w-]+$/.test(encoded)) throw new TypeError("Invalid world specification link.");
  const bytes = Uint8Array.from(atob(encoded.replaceAll("-", "+").replaceAll("_", "/")), char => char.charCodeAt(0));
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate")).getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) throw new RangeError("World specification is too large.");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return parseWorldHandoff(await new Blob(chunks as BlobPart[]).text());
}

export function saveWorldHandoff(handoff: WorldHandoff, storage: Pick<Storage, "setItem">): void {
  storage.setItem(LAST_SPEC_KEY, JSON.stringify(parseWorldHandoff(JSON.stringify(handoff))));
}

/** Explicit links take precedence; corrupt links must not load an unrelated saved world. */
export async function loadWorldHandoff(hash: string, readSaved: () => string | null): Promise<WorldHandoff | null> {
  const linked = await decodeWorldHash(hash);
  if (linked) return linked;
  const saved = readSaved();
  return saved === null ? null : parseWorldHandoff(saved);
}
