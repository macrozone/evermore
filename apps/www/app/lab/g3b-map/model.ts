export const SOURCES = [
  { id: "cabin", label: "it2 · Forest cabin (evening)", url: "/moodboards/02-eigene-welt/images/it2-waldhuette-abend.jpg" },
  { id: "harbour", label: "it2 · Harbour (evening)", url: "/moodboards/02-eigene-welt/images/it2-hafenstadt-abend.jpg" },
] as const;
export type Approach = "image" | "vision";
export type Masks = { width: number; height: number; collision: Uint8Array; overhead: Uint8Array };
export type Region = { label: string; kind: "collision" | "overhead" | "free"; polygon: [number, number][] };
export type MaskResult = { approach: Approach; model: string; width: number; height: number; mask?: string; regions?: Region[]; durationMs: number; estimatedCostUsd: number; costBasis: "usage" | "output-only"; generatedAt: string; outputWidth?: number; outputHeight?: number };
export function parseRegions(value: unknown): Region[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 160) throw new TypeError("Expected 1–160 regions.");
  return value.map(raw => {
    if (typeof raw !== "object" || raw === null) throw new TypeError("Invalid region.");
    const r = raw as Record<string, unknown>;
    if (typeof r.label !== "string" || r.label.length > 100 || !["collision", "overhead", "free"].includes(String(r.kind)) || !Array.isArray(r.polygon) || r.polygon.length < 3 || r.polygon.length > 80) throw new TypeError("Invalid region geometry.");
    const polygon = r.polygon.map(p => {
      if (!Array.isArray(p) || p.length !== 2 || !p.every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1000)) throw new TypeError("Coordinates must be [x,y] in 0–1000.");
      return p as [number, number];
    });
    return { label: r.label, kind: r.kind as Region["kind"], polygon };
  });
}
export function emptyMasks(width: number, height: number): Masks {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 2048 || height > 2048) throw new TypeError("Mask size must be within 2048 × 2048.");
  return { width, height, collision: new Uint8Array(width * height), overhead: new Uint8Array(width * height) };
}
/** Nearest canonical colour tolerates antialiasing without inventing material classes. */
export function decodeColourMask(width: number, height: number, data: ArrayLike<number>): Masks {
  const masks = emptyMasks(width, height);
  if (data.length !== width * height * 4) throw new TypeError("Mask pixels do not match source dimensions.");
  const colours = [[255,255,255,0,0], [0,0,0,1,0], [255,0,0,0,1], [255,0,255,1,1]];
  for (let i = 0; i < width * height; i++) {
    if (data[i*4+3]! < 128) throw new TypeError("Mask contains transparent/unknown pixels.");
    let best = colours[0]!, distance = Infinity;
    for (const c of colours) { const d = (data[i*4]! - c[0]!)**2 + (data[i*4+1]! - c[1]!)**2 + (data[i*4+2]! - c[2]!)**2; if (d < distance) { distance = d; best = c; } }
    masks.collision[i] = best[3]!; masks.overhead[i] = best[4]!;
  }
  return masks;
}
function inside(x: number, y: number, polygon: Region["polygon"]) {
  let hit = false;
  for (let i = 0, j = polygon.length-1; i < polygon.length; j = i++) {
    const a = polygon[i]!, b = polygon[j]!;
    if ((a[1] > y) !== (b[1] > y) && x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) hit = !hit;
  }
  return hit;
}
export function rasterizeRegions(width: number, height: number, regions: Region[]): Masks {
  const masks = emptyMasks(width, height);
  // Door/bridge/path exceptions clear collision after all solid regions, never overhead.
  for (const r of [...regions.filter(r => r.kind !== "free"), ...regions.filter(r => r.kind === "free")]) {
    const xs = r.polygon.map(p => p[0]*width/1000), ys = r.polygon.map(p => p[1]*height/1000);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y < Math.min(height, Math.ceil(Math.max(...ys))); y++) {
      for (let x = Math.max(0, Math.floor(Math.min(...xs))); x < Math.min(width, Math.ceil(Math.max(...xs))); x++) {
        if (!inside((x+.5)*1000/width, (y+.5)*1000/height, r.polygon)) continue;
        const i = y*width+x;
        if (r.kind === "overhead") masks.overhead[i] = 1; else masks.collision[i] = r.kind === "collision" ? 1 : 0;
      }
    }
  }
  return masks;
}
/** Conservative cell reduction: any blocked pixel blocks its 16 px cell. */
export function gridMasks(source: Masks, size: number): Masks {
  if (!Number.isInteger(size) || size < 1 || size > 2048) throw new TypeError("Invalid grid size.");
  if (size === 1) return source;
  const result = emptyMasks(source.width, source.height);
  for (let y = 0; y < source.height; y += size) for (let x = 0; x < source.width; x += size) {
    let c = 0, o = 0;
    const right = Math.min(x+size,source.width), bottom = Math.min(y+size,source.height);
    for (let py = y; py < bottom; py++) for (let px = x; px < right; px++) { const i=py*source.width+px; c |= source.collision[i]!; o |= source.overhead[i]!; }
    for (let py = y; py < bottom; py++) { result.collision.fill(c,py*source.width+x,py*source.width+right); result.overhead.fill(o,py*source.width+x,py*source.width+right); }
  }
  return result;
}
/** Feet use a small rectangle; the visible head must not collide with a roof. */
export function walkable(masks: Masks, x: number, y: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.floor(x-4) < 0 || Math.floor(y-2) < 0 || Math.ceil(x+4) >= masks.width || Math.ceil(y+2) >= masks.height) return false;
  for (let py = Math.floor(y-2); py <= Math.ceil(y+2); py++) for (let px = Math.floor(x-4); px <= Math.ceil(x+4); px++) if (masks.collision[py*masks.width+px] === 1) return false;
  return true;
}
export type Brush = "collision" | "overhead" | "both" | "clear-collision" | "clear-overhead" | "clear";
/** Paint a swept disk in source coordinates, even across sparse pointer events. */
export function paintMasks(source: Masks, from: { x: number; y: number }, to: { x: number; y: number }, radius: number, brush: Brush): Masks {
  if (![from.x, from.y, to.x, to.y, radius].every(Number.isFinite) || radius < 1 || radius > 128) throw new TypeError("Invalid brush stroke.");
  const result = { ...source, collision: source.collision.slice(), overhead: source.overhead.slice() };
  const dx = to.x - from.x, dy = to.y - from.y, length = dx*dx + dy*dy;
  const left = Math.max(0, Math.floor(Math.min(from.x, to.x)-radius)), right = Math.min(source.width, Math.ceil(Math.max(from.x, to.x)+radius));
  const top = Math.max(0, Math.floor(Math.min(from.y, to.y)-radius)), bottom = Math.min(source.height, Math.ceil(Math.max(from.y, to.y)+radius));
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
    const t = length > 0 ? Math.max(0, Math.min(1, ((x+.5-from.x)*dx+(y+.5-from.y)*dy)/length)) : 0;
    if ((x+.5-from.x-t*dx)**2+(y+.5-from.y-t*dy)**2 > radius*radius) continue;
    const i = y*source.width+x;
    if (brush === "collision" || brush === "both") result.collision[i] = 1;
    if (brush === "overhead" || brush === "both") result.overhead[i] = 1;
    if (brush === "clear-collision" || brush === "clear") result.collision[i] = 0;
    if (brush === "clear-overhead" || brush === "clear") result.overhead[i] = 0;
  }
  return result;
}
export function safeSpawn(masks: Masks, preferred = { x: masks.width/2, y: masks.height*.72 }) {
  if (walkable(masks, preferred.x, preferred.y)) return preferred;
  let best: {x:number;y:number} | undefined, distance = Infinity;
  for (let y=4;y<masks.height-4;y+=4) for(let x=6;x<masks.width-6;x+=4) {
    const d=(x-preferred.x)**2+(y-preferred.y)**2;
    if(d<distance && walkable(masks,x,y)) { distance=d;best={x,y}; }
  }
  return best;
}
export function occluded(masks: Masks, x: number, y: number) {
  for(let py=Math.max(0,Math.floor(y-22));py<Math.min(masks.height,y+2);py++) for(let px=Math.max(0,Math.floor(x-5));px<Math.min(masks.width,x+5);px++) if(masks.overhead[py*masks.width+px] === 1) return true;
  return false;
}
