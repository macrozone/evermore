/** Shared by offline library preparation and the local live generator. */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
export const OBJECT_STYLE = 'Single isolated cozy SNES RPG pixel-art sprite. Axis-aligned top-down south-facing view like Stardew Valley, horizontal and vertical edges, NOT 45-degree isometric. Crisp pixel clusters, warm terracotta, cream, brown timber and muted sage foliage. Light from upper left. Entire object centered with generous empty margin on perfectly flat pure magenta #ff00ff background. No ground, no cast shadow, no text, no labels, no other objects. Match the attached library reference in palette, pixel clusters and camera direction, not in subject. Roof ridges must be horizontal as in the reference; never rotate the view.';
export const OBJECT_PIPELINE_VERSION = 2;
export const OBJECT_STYLE_REFERENCE = 'objects/source/well.png';
export async function loadObjectStyleReference(publicDirectory) {
  return { inlineData: { mimeType: 'image/png', data: (await readFile(join(publicDirectory, OBJECT_STYLE_REFERENCE))).toString('base64') } };
}

export async function prepareObjectSprite(source, width, height, pixelSize = 1, palette = []) {
  const { data, info } = await sharp(source, { limitInputPixels: 4_194_304 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4;
    // Magenta is reserved for the background, outside the sprite palette.
    if (data[i] > data[i + 1] + 25 && data[i + 2] > data[i + 1] + 25) data[i + 3] = 0;
    if (data[i + 3]) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  }
  if (left > right || top > bottom) throw new Error('Empty cutout');
  const smallWidth = Math.ceil(width / pixelSize), smallHeight = Math.ceil(height / pixelSize);
  const { data: pixels, info: smallInfo } = await sharp(data, { raw: info })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize(smallWidth, smallHeight, { fit: 'contain', kernel: 'nearest', background: '#00000000' })
    .raw().toBuffer({ resolveWithObject: true });
  const colors = palette.map(hex => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)));
  if (colors.length) for (let i = 0; i < pixels.length; i += 4) {
    if (!pixels[i + 3]) continue;
    let nearest = colors[0], distance = Infinity;
    for (const color of colors) {
      const d = (pixels[i] - color[0]) ** 2 + (pixels[i + 1] - color[1]) ** 2 + (pixels[i + 2] - color[2]) ** 2;
      if (d < distance) { nearest = color; distance = d; }
    }
    pixels[i] = nearest[0]; pixels[i + 1] = nearest[1]; pixels[i + 2] = nearest[2];
  }
  return sharp(pixels, { raw: smallInfo }).resize(width, height, { kernel: 'nearest' }).png().toBuffer();
}
