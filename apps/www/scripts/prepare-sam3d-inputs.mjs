import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = path.resolve(root, "public/objects-3d/inputs");
await mkdir(out, { recursive: true });
const manifest = [];
for (const id of ["house", "tree", "well", "lantern"]) {
  const source = await readFile(path.join(root, `public/objects/${id}.png`));
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgb = Buffer.alloc(info.width * info.height * 3, 255);
  const mask = Buffer.alloc(info.width * info.height);
  for (let p = 0; p < mask.length; p++) {
    mask[p] = data[p * 4 + 3] >= 128 ? 255 : 0;
    if (mask[p]) for (let c = 0; c < 3; c++) rgb[p * 3 + c] = data[p * 4 + c];
  }
  const image = await sharp(rgb, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer();
  const maskPng = await sharp(mask, { raw: { width: info.width, height: info.height, channels: 1 } }).png().toBuffer();
  await writeFile(path.join(out, `${id}.png`), image);
  await writeFile(path.join(out, `${id}-mask.png`), maskPng);
  manifest.push({ id, source: `/objects/${id}.png`, sourceSha256: createHash("sha256").update(source).digest("hex"), image: `${id}.png`, mask: `${id}-mask.png`, width: info.width, height: info.height, alphaThreshold: 128, seed: 42, reconstruction: null });
}
await writeFile(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Prepared ${manifest.length} RGB images and alpha masks; no reconstruction performed.`);
