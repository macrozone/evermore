import sharp from "sharp";
import type { FrameMeasure } from "../../../../lab/character/image-specification";

export async function decodeImage(bytes: Buffer) {
  const image = sharp(bytes, { limitInputPixels: 2048 * 2048 });
  const info = await image.metadata();
  if (info.width === undefined || info.height === undefined || info.width > 2048 || info.height > 2048) throw new Error("Image dimensions exceed 2048 × 2048.");
  const png = await image.png().toBuffer();
  if (png.length > 6_000_000) throw new Error("Image exceeds the memory limit.");
  return png;
}

/** Cut the regular grid first; use one shared transform so anatomy and foot anchors do not drift. */
export async function prepareCharacterSheet(bytes: Buffer) {
  const { data, info } = await sharp(bytes, { limitInputPixels: 2048 * 2048 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width < 16 || info.height < 16 || info.width % 4 !== 0 || info.height % 4 !== 0) throw new Error("Expected an evenly divisible 4 × 4 sheet.");
  const cw = info.width / 4, ch = info.height / 4;
  // Some models draw separator lines despite the prompt. Reserve a narrow cell
  // gutter so those borders cannot become part of the character's silhouette.
  const gutterX = Math.floor(cw * 0.02), gutterY = Math.floor(ch * 0.02);
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (x % cw < gutterX || x % cw >= cw - gutterX || y % ch < gutterY || y % ch >= ch - gutterY) data[(y * info.width + x) * 4 + 3] = 0;
  }
  // First remove the chroma key, including slight model/compression variations.
  for (let i = 0; i < data.length; i += 4) {
    if (data[i]! > 150 && data[i + 2]! > 150 && data[i]! > data[i + 1]! + 80 && data[i + 2]! > data[i + 1]! + 80) data[i + 3] = 0;
  }
  // Remove isolated speckles per cell before deriving shared bounds. Retain
  // meaningful disconnected details (e.g. a staff) relative to the main body.
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const visited = new Uint8Array(cw * ch), components: number[][] = [];
    const alpha = (p: number) => ((row * ch + Math.floor(p / cw)) * info.width + col * cw + p % cw) * 4 + 3;
    for (let p = 0; p < visited.length; p++) {
      if (visited[p] === 1 || data[alpha(p)] === 0) continue;
      const queue = [p]; visited[p] = 1;
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const q = queue[cursor]!, x = q % cw, y = Math.floor(q / cw);
        const neighbors = [x > 0 ? q - 1 : -1, x + 1 < cw ? q + 1 : -1, y > 0 ? q - cw : -1, y + 1 < ch ? q + cw : -1];
        for (const next of neighbors) if (next >= 0 && visited[next] !== 1 && data[alpha(next)] !== 0) { visited[next] = 1; queue.push(next); }
      }
      components.push(queue);
    }
    const largest = components.reduce((max, c) => Math.max(max, c.length), 0);
    const threshold = Math.max(1, Math.floor(largest * 0.005));
    for (const component of components) if (component.length < threshold) for (const pixel of component) data[alpha(pixel)] = 0;
  }
  let left = cw, top = ch, right = -1, bottom = -1;
  const bounds = Array.from({ length: 16 }, () => ({ left: cw, top: ch, right: -1, bottom: -1, pixels: 0 }));
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4;
    if (data[i + 3] === 0) continue;
    const lx = x % cw, ly = y % ch, b = bounds[Math.floor(y / ch) * 4 + Math.floor(x / cw)]!;
    b.left = Math.min(b.left, lx); b.top = Math.min(b.top, ly); b.right = Math.max(b.right, lx); b.bottom = Math.max(b.bottom, ly); b.pixels++;
    left = Math.min(left, lx); top = Math.min(top, ly); right = Math.max(right, lx); bottom = Math.max(bottom, ly);
  }
  if (bounds.some(b => b.pixels === 0)) throw new Error("One or more frames are empty. Ask for a complete 4 × 4 sheet.");
  const frameWidth = 32, frameHeight = 43;
  const ratio = Math.min((frameWidth - 4) / (right - left + 1), (frameHeight - 4) / (bottom - top + 1));
  const w = Math.max(1, Math.round((right - left + 1) * ratio)), h = Math.max(1, Math.round((bottom - top + 1) * ratio));
  const composites = await Promise.all(bounds.map(async (_, index) => ({
    input: await sharp(data, { raw: info }).extract({ left: index % 4 * cw + left, top: Math.floor(index / 4) * ch + top, width: right - left + 1, height: bottom - top + 1 }).resize(w, h, { kernel: "lanczos3" }).png().toBuffer(),
    left: index % 4 * frameWidth + Math.floor((frameWidth - w) / 2), top: Math.floor(index / 4) * frameHeight + frameHeight - 2 - h,
  })));
  const sheet = await sharp({ create: { width: frameWidth * 4, height: frameHeight * 4, channels: 4, background: "#00000000" } }).composite(composites).png({ palette: true, colours: 32, dither: 0 }).toBuffer();
  const frames: FrameMeasure[] = bounds.map(b => ({ pixels: b.pixels, width: b.right - b.left + 1, height: b.bottom - b.top + 1, bottom: b.bottom }));
  return { sheet, frameWidth, frameHeight, frames };
}
