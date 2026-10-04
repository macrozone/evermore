import sharp from "sharp";
import type { AssetRole } from "../../../lab/asset-generator/generation";

const options = { limitInputPixels: 4_194_304 };
/** Remove only keyed background connected to the image border, preserving purple subjects. */
export async function prepareAsset(bytes: Buffer, role: AssetRole): Promise<Buffer> {
  const width = role.widthTiles * 16, height = role.heightTiles * 16;
  if (role.role === "surface") return sharp(bytes, options).removeAlpha().resize(width, height, { fit: "fill", kernel: "nearest" }).ensureAlpha().raw().toBuffer();
  const { data, info } = await sharp(bytes, options).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const seen = new Uint8Array(info.width * info.height), queue: number[] = [];
  const visit = (p: number) => {
    if (seen[p] === 1) return;
    seen[p] = 1;
    const i = p * 4;
    if (data[i + 3] === 0 || (data[i]! > 150 && data[i + 2]! > 150 && data[i + 1]! < 110 && data[i]! - data[i + 1]! > 80 && data[i + 2]! - data[i + 1]! > 80)) { data[i + 3] = 0; queue.push(p); }
  };
  for (let x = 0; x < info.width; x++) { visit(x); visit((info.height - 1) * info.width + x); }
  for (let y = 0; y < info.height; y++) { visit(y * info.width); visit(y * info.width + info.width - 1); }
  for (let q = 0; q < queue.length; q++) {
    const p = queue[q]!, x = p % info.width, y = Math.floor(p / info.width);
    if (x > 0) visit(p - 1); if (x + 1 < info.width) visit(p + 1);
    if (y > 0) visit(p - info.width); if (y + 1 < info.height) visit(p + info.width);
  }
  // Enclosed holes (windows, fence gaps) also use the reserved pure key color.
  // A stricter threshold here retains muted purple subject details.
  for (let i = 0; i < data.length; i += 4) if (data[i]! > 180 && data[i + 2]! > 180 && data[i + 1]! < 95 && data[i]! - data[i + 1]! > 110 && data[i + 2]! - data[i + 1]! > 110) data[i + 3] = 0;
  let left = info.width, right = -1, top = info.height, bottom = -1, transparent = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3]! > 0) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
    else transparent++;
  }
  if (right < left) throw new Error("Empty cutout. Try a clearer isolated subject.");
  if (transparent === 0) throw new Error("No transparent background found. Try an isolated subject without ground.");
  if (role.role === "strip") return sharp(data, { raw: info }).extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize(width, height - 2, { fit: "fill", kernel: "nearest" }).extend({ top: 1, bottom: 1, background: "#00000000" }).raw().toBuffer();
  // A one-pixel transparent margin keeps the ground anchor and silhouette readable.
  return sharp(data, { raw: info }).extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize(width - 2, height - 2, { fit: "contain", kernel: "nearest", background: "#00000000" })
    .extend({ top: 1, bottom: 1, left: 1, right: 1, background: "#00000000" }).raw().toBuffer();
}

/** Match every variant to one family border, with a eight-pixel blend band.
 * Surface borders repeat XY; strips only X. Raw provider images remain available. */
export function repairFamilyEdges(images: Buffer[], width: number, height: number, axes: "xy" | "x"): Buffer[] {
  if (images.length === 0) return [];
  const base = images[0]!, edge = Buffer.from(base);
  // Blend mirrored edge neighborhoods rather than smearing one edge row into a band.
  for (let y = 0; y < height; y++) for (let x = 0; x < Math.min(8, width / 2); x++) for (let c = 0; c < 4; c++) {
    const a = (y * width + x) * 4 + c, b = (y * width + width - 1 - x) * 4 + c, weight = 0.5 * (1 - x / 8);
    edge[a] = Math.round(base[a]! * (1 - weight) + base[b]! * weight);
    edge[b] = Math.round(base[b]! * (1 - weight) + base[a]! * weight);
  }
  if (axes === "xy") for (let y = 0; y < Math.min(8, height / 2); y++) for (let x = 0; x < width; x++) for (let c = 0; c < 4; c++) {
    const a = (y * width + x) * 4 + c, b = ((height - 1 - y) * width + x) * 4 + c, weight = 0.5 * (1 - y / 8);
    const first = edge[a]!, last = edge[b]!;
    edge[a] = Math.round(first * (1 - weight) + last * weight);
    edge[b] = Math.round(last * (1 - weight) + first * weight);
  }
  const stats = (image: Buffer) => [0, 1, 2].map(c => {
    let mean = 0;
    for (let i = c; i < image.length; i += 4) mean += image[i]!;
    return mean / (width * height);
  });
  const baseMean = stats(base);
  return images.map(original => {
    const image = Buffer.from(original), mean = stats(original);
    if (axes === "xy") for (let i = 0; i < image.length; i += 4) for (let c = 0; c < 3; c++) image[i + c] = Math.max(0, Math.min(255, Math.round(image[i + c]! + baseMean[c]! - mean[c]!)));
    const output = Buffer.from(image);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const dx = Math.min(x, width - 1 - x), dy = Math.min(y, height - 1 - y);
      const wx = Math.max(0, 1 - dx / 8), wy = axes === "xy" ? Math.max(0, 1 - dy / 8) : 0;
      const w = Math.max(wx, wy);
      if (w === 0) continue;
      for (let c = 0; c < 4; c++) {
        const i = (y * width + x) * 4 + c;
        output[i] = Math.round(image[i]! * (1 - w) + edge[i]! * w);
      }
    }
    // Intersections of blend bands must also share exact family boundaries.
    for (let y = 0; y < height; y++) for (const x of [0, width - 1]) edge.copy(output, (y * width + x) * 4, (y * width + x) * 4, (y * width + x) * 4 + 4);
    if (axes === "xy") for (const y of [0, height - 1]) edge.copy(output, y * width * 4, y * width * 4, (y + 1) * width * 4);
    return output;
  });
}
export function seamError(image: Buffer, width: number, height: number) {
  let horizontal = 0, vertical = 0;
  for (let y = 0; y < height; y++) for (let c = 0; c < 4; c++) horizontal += Math.abs(image[(y * width) * 4 + c]! - image[(y * width + width - 1) * 4 + c]!);
  for (let x = 0; x < width; x++) for (let c = 0; c < 4; c++) vertical += Math.abs(image[x * 4 + c]! - image[((height - 1) * width + x) * 4 + c]!);
  return { horizontal: horizontal / (height * 4), vertical: vertical / (width * 4) };
}
export function proceduralVariant(base: Buffer, width: number, height: number, seed: number, index: number) {
  if (index === 0) return Buffer.from(base);
  const out = Buffer.alloc(base.length), flip = (seed + index) % 2 === 0;
  const tint = ((seed * 17 + index * 31) % 19) - 9;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const src = (y * width + (flip ? width - 1 - x : x)) * 4, dest = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) out[dest + c] = Math.max(0, Math.min(255, base[src + c]! + tint * (c === 1 ? 0.5 : 1)));
    out[dest + 3] = base[src + 3]!;
  }
  return out;
}
export const encodeAsset = (pixels: Buffer, width: number, height: number) => sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
