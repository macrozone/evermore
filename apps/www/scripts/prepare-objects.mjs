/** Deterministic chroma cutout and 16px tile normalization. */
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('next/package.json'))('sharp');
const sizes = { cottage: [64, 64], house: [96, 96], tree: [48, 64], bush: [32, 32], well: [32, 48], fence: [48, 32], lantern: [16, 48] };
for (const [id, [width, height]] of Object.entries(sizes)) {
  const source = new URL(`../public/objects/source/${id}.png`, import.meta.url);
  const { data, info } = await sharp(await readFile(source)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = 0, bottom = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4;
    // The reserved magenta key is deliberately absent from the sprite palette.
    if (data[i] > data[i + 1] + 25 && data[i + 2] > data[i + 1] + 25) data[i + 3] = 0;
    if (data[i + 3]) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  }
  if (left > right) throw new Error(`Empty cutout: ${id}`);
  const sprite = await sharp(data, { raw: info }).extract({ left, top, width: right - left + 1, height: bottom - top + 1 }).resize(width, height, { fit: 'contain', kernel: 'nearest', background: '#00000000' }).png().toBuffer();
  await writeFile(new URL(`../public/objects/${id}.png`, import.meta.url), sprite);
  console.log(`${id}: ${width}×${height}`);
}
