/** Deterministic chroma cutout and 16px tile normalization. */
import { readFile, writeFile } from 'node:fs/promises';
import { prepareObjectSprite } from '../lib/object-assets.mjs';
const sizes = { cottage: [64, 64], house: [96, 96], tree: [48, 64], bush: [32, 32], well: [32, 48], fence: [48, 32], lantern: [16, 48] };
for (const [id, [width, height]] of Object.entries(sizes)) {
  const source = new URL(`../public/objects/source/${id}.png`, import.meta.url);
  const sprite = await prepareObjectSprite(await readFile(source), width, height);
  await writeFile(new URL(`../public/objects/${id}.png`, import.meta.url), sprite);
  console.log(`${id}: ${width}×${height}`);
}
