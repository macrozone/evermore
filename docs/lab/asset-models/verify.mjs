/** Verify benchmark coverage, provenance and actual decoded pixels without making API calls. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(new URL('../../../apps/www/package.json', import.meta.url));
const sharp = require('sharp');
const dir = new URL('./', import.meta.url);
const samples = JSON.parse(await readFile(new URL('measurements.json', dir), 'utf8'));
const options = ['flash-lite', 'flash', 'flash-512', 'pro', 'flash-reference', 'flash-reference-guided'];
assert.equal(samples.length, options.length * 3);
const prompts = new Map();
for (const option of options) for (const subject of ['tree', 'house', 'grass']) {
  const sample = samples.find(item => item.option === option && item.subject === subject);
  assert.ok(sample, `${option}/${subject} missing`);
  assert.ok(sample.durationMs > 0 && sample.usage, 'Missing timing or usage evidence');
  if (!prompts.has(subject)) prompts.set(subject, sample.prompt);
  assert.equal(sample.prompt, prompts.get(subject), 'Text prompts must be identical');
  assert.equal(Boolean(sample.referenceImage), option.startsWith('flash-reference'));
  const raw = await sharp(await readFile(new URL(`${option}/${subject}.png`, dir))).metadata();
  assert.equal(raw.width, sample.width);
  assert.equal(raw.height, sample.height);
  assert.equal(raw.hasAlpha, sample.hasAlpha);
  for (const size of [16, 32, 64]) for (const suffix of ['', '-unquantized']) {
    const { data, info } = await sharp(await readFile(new URL(`${option}/${subject}-${size}${suffix}.png`, dir))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, size);
    assert.equal(info.height, size);
    const alpha = [...data].filter((_, i) => i % 4 === 3);
    if (subject === 'grass') assert.ok(alpha.every(value => value === 255), 'Ground must remain opaque');
    else assert.ok(alpha.includes(0) && alpha.includes(255), 'Sprite cutout must contain both clear and solid pixels');
  }
}
console.log(`Verified ${samples.length} originals, 108 tiny derivatives, identical text prompts, dimensions and alpha.`);
for (const option of options) {
  const group = samples.filter(sample => sample.option === option);
  const seconds = group.map(sample => sample.durationMs / 1000).sort((a, b) => a - b);
  const rate = option === 'flash-lite' ? [0.25, 1.5, 30] : option === 'pro' ? [2, 12, 120] : [0.5, 3, 60];
  const costs = group.map(({ usage }) => {
    const input = usage.promptTokenCount;
    const image = usage.candidatesTokensDetails.filter(item => item.modality === 'IMAGE').reduce((sum, item) => sum + item.tokenCount, 0);
    const text = usage.candidatesTokenCount - image + (usage.thoughtsTokenCount || 0);
    return (input * rate[0] + text * rate[1] + image * rate[2]) / 1_000_000;
  });
  const grass = JSON.parse(await readFile(new URL(`${option}/grass.processing.json`, dir), 'utf8'));
  console.log(JSON.stringify({ option, medianSeconds: seconds[1], rangeSeconds: [seconds[0], seconds[2]], estimatedCostPerAssetUsd: costs.reduce((sum, value) => sum + value, 0) / costs.length, estimatedTotalUsd: costs.reduce((sum, value) => sum + value, 0), grass64: grass.sizes['64'] }));
}
