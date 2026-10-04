/** Paid live runs are explicit; screenshots always use headless Chromium. */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const live = process.argv.includes('--live');
const origin = process.env.ASSET_TEST_ORIGIN ?? 'http://127.0.0.1:31132';
const url = new URL(origin);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.protocol !== 'http:') throw new Error('Use a local development origin.');
const examples = join(root, 'apps/www/public/asset-generator/examples');
const evidence = join(root, 'docs/lab/asset-generator');
await mkdir(examples, { recursive: true }); await mkdir(evidence, { recursive: true });
const runs = [
  ['Mossy boulder with tiny ferns', 'independent'],
  ['Crooked fishing hut with a red tiled roof', 'independent'],
  ['Cobblestones with grass in the joints', 'independent'],
  ['Flowering bush with cream blossoms', 'independent'],
  ['Weathered wooden fence with climbing ivy', 'independent'],
  ['Mossy boulder with tiny ferns', 'reference'],
  ['Mossy boulder with tiny ferns', 'procedural'],
];
if (live) {
  const batches = [];
  for (let run = 0; run < runs.length; run++) {
    const [description, strategy] = runs[run];
    const input = { action: 'generate', description, strategy, seed: 42 + run * 100 };
    console.log(`LIVE ${run + 1}/${runs.length}: ${description} / ${strategy}`);
    const response = await fetch(`${origin}/api/lab/asset-generator`, { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(1_000_000) });
    const batch = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(batch));
    const folder = `run-${run + 1}`;
    await mkdir(join(examples, folder), { recursive: true });
    for (const v of batch.variants) {
      const save = async (data, name) => { const [, mime, base64] = /^data:([^;]+);base64,(.+)$/.exec(data); const extension = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png'; const path = `${folder}/${name}.${extension}`; await writeFile(join(examples, path), Buffer.from(base64, 'base64')); return `/asset-generator/examples/${path}`; };
      v.sprite = await save(v.sprite, `variant-${v.index + 1}`); v.raw = await save(v.raw, `raw-${v.index + 1}`);
    }
    batch.recordedAt = new Date().toISOString();
    batches.push(batch);
    await writeFile(join(examples, 'index.json'), JSON.stringify(batches, null, 2) + '\n');
    console.log(JSON.stringify({ description, role: batch.parameters, variants: batch.variants.length, errors: batch.errors, durationMs: batch.durationMs, estimatedCostUsd: batch.estimatedCostUsd }));
  }
  await writeFile(join(evidence, 'measurements.json'), JSON.stringify(batches.map(({ variants, ...batch }) => ({ ...batch, variants: variants.map(({ raw: _raw, sprite: _sprite, ...v }) => v) })), null, 2) + '\n');
}
const batches = JSON.parse(await readFile(join(examples, 'index.json'), 'utf8'));
if (process.argv.includes('--prepare')) {
  const { prepareAsset, repairFamilyEdges, proceduralVariant, encodeAsset, seamError } = await import('../app/api/lab/asset-generator/prepare.ts');
  for (const batch of batches) {
    const w = batch.parameters.widthTiles * 16, h = batch.parameters.heightTiles * 16;
    let base;
    const prepared = [];
    for (const v of batch.variants) {
      const raw = await readFile(join(root, 'apps/www/public', v.raw));
      const pixels = v.source === 'procedural' ? proceduralVariant(base, w, h, batch.seed, v.index) : await prepareAsset(raw, batch.parameters);
      base ??= pixels; prepared.push(pixels);
    }
    const pixels = batch.parameters.role === 'object' ? prepared : repairFamilyEdges(prepared, w, h, batch.parameters.role === 'surface' ? 'xy' : 'x');
    for (let i = 0; i < batch.variants.length; i++) {
      const v = batch.variants[i]; v.seamError = seamError(pixels[i], w, h);
      await writeFile(join(root, 'apps/www/public', v.sprite), await encodeAsset(pixels[i], w, h));
    }
    batch.preparationVersion = 3;
  }
  await writeFile(join(examples, 'index.json'), JSON.stringify(batches, null, 2) + '\n');
  await writeFile(join(evidence, 'measurements.json'), JSON.stringify(batches.map(({ variants, ...batch }) => ({ ...batch, variants: variants.map(({ raw: _raw, sprite: _sprite, ...v }) => v) })), null, 2) + '\n');
}

if (new Set(batches.map(b => b.description)).size < 5) throw new Error('Five distinct descriptions are required.');
for (const batch of batches) {
  if (batch.variants.length !== 10 || batch.errors.length !== 0) throw new Error(`Incomplete batch: ${batch.description}`);
  let firstPixels;
  for (const v of batch.variants) {
    const file = await readFile(join(root, 'apps/www/public', v.sprite));
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== v.width || info.height !== v.height) throw new Error('Wrong sprite dimensions.');
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] === 0) transparent++;
    if (batch.parameters.role === 'surface' ? transparent !== 0 : transparent === 0) throw new Error('Wrong sprite opacity.');
    if (batch.parameters.role !== 'object') {
      for (let y = 0; y < v.height; y++) {
        const left = y * v.width * 4, right = (y * v.width + v.width - 1) * 4;
        if (!data.subarray(left, left + 4).equals(data.subarray(right, right + 4))) throw new Error('Broken decoded X seam.');
        if (firstPixels && !data.subarray(left, left + 4).equals(firstPixels.subarray(right, right + 4))) throw new Error('Broken cross-variant seam.');
      }
      if (batch.parameters.role === 'surface' && !data.subarray(0, v.width * 4).equals(data.subarray((v.height - 1) * v.width * 4))) throw new Error('Broken decoded Y seam.');
    }
    firstPixels ??= data;
  }
  if (batch.parameters.role !== 'object') for (const v of batch.variants) if (v.seamError.horizontal !== 0 || (batch.parameters.role === 'surface' && v.seamError.vertical !== 0)) throw new Error('Broken periodic edges.');
}
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${origin}/lab/asset-generator`);
  await page.getByRole('button', { name: 'Load recorded experiments (no calls)' }).click();
  await page.getByRole('combobox', { name: 'Active family' }).selectOption('2');
  await page.getByRole('button', { name: 'Variant grid', exact: true }).click();
  await page.getByRole('button', { name: 'Select variant 10', exact: true }).waitFor();
  await page.screenshot({ path: join(evidence, 'grid.png'), fullPage: true });
  await page.getByRole('button', { name: 'Test scene', exact: true }).click();
  await page.waitForTimeout(1500); await page.screenshot({ path: join(evidence, 'scene.png'), fullPage: true });
  await page.getByRole('button', { name: 'Seam close-up', exact: true }).click();
  await page.waitForTimeout(1000); await page.screenshot({ path: join(evidence, 'seam.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('canvas').evaluate(canvas => canvas.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: join(evidence, 'mobile.png') });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Verified ${batches.length} recorded batches; headless grid/scene/seam/mobile screenshots saved.`);
} finally { await browser.close(); }
