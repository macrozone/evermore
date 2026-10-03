/** Explicit offline experiment. Usage: node apps/www/scripts/generate-heightmaps.mjs [model] */
import { generateHeightMaps, HEIGHT_MODELS } from '../lib/heightmap-assets.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const output = fileURLToPath(new URL('../../../docs/lab/experiments/heightmap-test/iteration-3/', import.meta.url));
const result = await generateHeightMaps({ publicDir, source: 'cabin', model: process.argv[2] ?? HEIGHT_MODELS[0].id });
await mkdir(output, { recursive: true });
for (const [name, bytes] of Object.entries({ 'height.png': result.heightmap, 'facade.png': result.facade, 'raw-height.png': result.rawHeight })) await writeFile(`${output}${name}`, bytes);
await writeFile(`${output}run.json`, JSON.stringify(result.metadata, null, 2) + '\n');
await writeFile(`${publicDir}image-to-voxel/cabin-top-height.png`, result.heightmap);
await writeFile(`${publicDir}image-to-voxel/cabin-facade.png`, result.facade);
await writeFile(`${publicDir}image-to-voxel/cabin-top-run.json`, JSON.stringify(result.metadata, null, 2) + '\n');
console.log(JSON.stringify(result.metadata));
