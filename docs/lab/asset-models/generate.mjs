/** Offline, paid Vertex benchmark. Run explicitly; existing successful samples are reused. */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
const require = createRequire(new URL('../../../apps/www/package.json', import.meta.url));
const { GoogleAuth } = require('google-auth-library');
const sharp = require('sharp');
const directory = fileURLToPath(new URL('./', import.meta.url));
const models = [
  { id: 'flash-lite', model: 'gemini-3.1-flash-lite-image', size: '1K' },
  { id: 'flash-lite-512', model: 'gemini-3.1-flash-lite-image', size: '512', probe: true },
  { id: 'flash-reference', model: 'gemini-3.1-flash-image', size: '1K', reference: true },
  { id: 'flash-reference-guided', model: 'gemini-3.1-flash-image', size: '1K', reference: true, guided: true },
  { id: 'flash', model: 'gemini-3.1-flash-image', size: '1K' },
  { id: 'flash-512', model: 'gemini-3.1-flash-image', size: '512' },
  { id: 'pro', model: 'gemini-3-pro-image', size: '1K' },
  { id: 'imagen-fast', model: 'imagen-4.0-fast-generate-001', size: '1K', imagen: true },
  { id: 'imagen', model: 'imagen-4.0-generate-001', size: '1K', imagen: true },
];
const style = 'Cozy SNES RPG pixel art. Axis-aligned orthographic top-down south-facing view, horizontal and vertical edges, never 45-degree isometric. Crisp readable pixel clusters, no antialiasing, no gradients. Warm terracotta, cream, brown timber, muted sage foliage. Light from upper left. Designed to remain readable at 64x64 pixels. No text, labels, watermarks or other objects.';
const subjects = {
  tree: 'One mature rounded oak tree, sage green canopy, sturdy brown trunk. Entire object centered with generous empty margin on perfectly flat pure magenta #ff00ff background. No ground or cast shadow.',
  house: 'One small timber cottage, horizontal terracotta roof ridge, cream walls, brown timber, golden windows and a centered door. Entire object centered with generous empty margin on perfectly flat pure magenta #ff00ff background. No ground or cast shadow.',
  grass: 'One seamless repeating grass ground texture, muted sage green with tiny warm ochre blades. Fill the entire square edge to edge. Opposite edges must match exactly for tiling in both axes. Uniform texture density, no border, no isolated object, no magenta background, no large shadow or central focal point.',
};
const palette = ['#243126','#3d5136','#607448','#8f9c68','#c2bf8a','#523b32','#856047','#b3825a','#c86644','#e29a63','#ead9ad','#fff0c7'];
const args = process.argv.slice(2);
const processOnly = args.includes('--process-only');
const selected = args.filter(arg => arg !== '--process-only');
// Default benchmark only calls active Gemini endpoints. Imagen is an explicit availability probe.
const active = models.filter(model => !model.imagen && !model.probe);
if (selected.some(id => !models.some(model => model.id === id))) throw new Error('Unknown model ID');
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
const project = process.env.GOOGLE_CLOUD_PROJECT || 'maw-evermore';
for (const spec of (processOnly ? [] : selected.length ? models.filter(model => selected.includes(model.id)) : active)) {
  await mkdir(`${directory}${spec.id}`, { recursive: true });
  for (const [subject, description] of Object.entries(subjects)) {
    const prefix = `${directory}${spec.id}/${subject}`;
    try { await access(`${prefix}.png`); console.log(`Reuse ${spec.id}/${subject}`); continue; } catch { /* Missing sample. */ }
    const prompt = `${style}\nSubject: ${description}`;
    const referenceImage = spec.reference ? './reference-well.png' : null;
    const referenceInstruction = spec.guided ? 'The attached well image is a STYLE REFERENCE ONLY. Match only its pixel cluster scale, lighting, palette and axis-aligned camera. Do not reproduce its well, roof, posts, stone circle or composition. Generate only the new subject specified below.' : null;
    const referenceBytes = referenceImage ? await readFile(new URL(referenceImage, import.meta.url)) : null;
    const referenceSha256 = referenceBytes ? createHash('sha256').update(referenceBytes).digest('hex') : null;
    const parts = [{ text: prompt }];
    if (referenceInstruction) parts.unshift({ text: referenceInstruction });
    if (referenceImage) parts.unshift({ inlineData: { mimeType: 'image/png', data: referenceBytes.toString('base64') } });
    const location = spec.imagen ? 'us-central1' : 'global';
    const host = spec.imagen ? `${location}-aiplatform.googleapis.com` : 'aiplatform.googleapis.com';
    const endpoint = `https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${spec.model}:${spec.imagen ? 'predict' : 'generateContent'}`;
    const body = spec.imagen
      ? { instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: '1:1', sampleImageSize: '1K', addWatermark: true, enhancePrompt: false, outputOptions: { mimeType: 'image/png' } } }
      : { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1', imageSize: spec.size } } };
    await writeFile(`${prefix}.request.json`, JSON.stringify({ model: spec.model, endpoint, body: spec.reference ? { ...body, contents: [{ role: 'user', parts: [{ referenceImage }, ...(referenceInstruction ? [{ text: referenceInstruction }] : []), { text: prompt }] }] } : body }, null, 2) + '\n');
    const startedAt = new Date().toISOString();
    const start = performance.now();
    const headers = new Headers(await auth.getRequestHeaders());
    headers.set('Content-Type', 'application/json');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(180_000) });
      const data = await response.json();
      const durationMs = Math.round(performance.now() - start);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${data.error?.message || 'Generation rejected'}`);
      const image = spec.imagen
        ? { data: data.predictions?.[0]?.bytesBase64Encoded, mimeType: data.predictions?.[0]?.mimeType }
        : data.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.mimeType?.startsWith('image/'))?.inlineData;
      if (!image?.data) throw new Error(`No image returned: ${data.candidates?.[0]?.finishReason || data.predictions?.[0]?.raiFilteredReason || 'empty response'}`);
      const bytes = Buffer.from(image.data, 'base64');
      // Preserve decoded pixels; encode PNG even if the service returned JPEG.
      await sharp(bytes).png().toFile(`${prefix}.png`);
      const metadata = await sharp(bytes).metadata();
      await writeFile(`${prefix}.json`, JSON.stringify({ model: spec.model, requestedSize: spec.size, prompt, startedAt, durationMs, width: metadata.width, height: metadata.height, responseMimeType: image.mimeType, hasAlpha: metadata.hasAlpha, usage: data.usageMetadata ?? null, seed: null, referenceImage, referenceInstruction, referenceSnapshot: referenceImage ? 'reference-well.png' : null, referenceSha256 }, null, 2) + '\n');
      console.log(`Generated ${spec.id}/${subject}: ${durationMs}ms ${metadata.width}x${metadata.height}`);
    } catch (error) {
      await writeFile(`${prefix}.error.json`, JSON.stringify({ model: spec.model, startedAt, durationMs: Math.round(performance.now() - start), message: error.message }, null, 2) + '\n');
      throw error; // Fail closed; no paid automatic retry on an uncertain outcome.
    }
  }
}
// Common postprocessing makes each model's tiny-resolution output comparable.
const colors = palette.map(hex => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)));
for (const spec of models) for (const subject of Object.keys(subjects)) {
  const prefix = `${directory}${spec.id}/${subject}`;
  let bytes;
  try { bytes = await readFile(`${prefix}.png`); } catch { continue; }
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let rawTransparent = 0, removed = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 255) rawTransparent++;
    if (subject !== 'grass' && data[i] > data[i + 1] + 25 && data[i + 2] > data[i + 1] + 25) { data[i + 3] = 0; removed++; }
  }
  const sizes = {};
  for (const size of [16, 32, 64]) {
    const { data: small, info: smallInfo } = await sharp(data, { raw: info }).resize(size, size, { kernel: 'nearest' }).raw().toBuffer({ resolveWithObject: true });
    await sharp(small, { raw: smallInfo }).png().toFile(`${prefix}-${size}-unquantized.png`);
    for (let i = 0; i < small.length; i += 4) {
      if (!small[i + 3]) continue;
      let best = colors[0], distance = Infinity;
      for (const color of colors) {
        const value = color.reduce((sum, channel, c) => sum + (small[i + c] - channel) ** 2, 0);
        if (value < distance) { best = color; distance = value; }
      }
      for (let c = 0; c < 3; c++) small[i + c] = best[c];
    }
    await sharp(small, { raw: smallInfo }).png().toFile(`${prefix}-${size}.png`);
    let horizontal = 0, vertical = 0, interior = 0, interiorCount = 0;
    const difference = (a, b) => [0, 1, 2].reduce((sum, c) => sum + Math.abs(small[a + c] - small[b + c]), 0);
    for (let y = 0; y < size; y++) horizontal += difference(y * size * 4, (y * size + size - 1) * 4);
    for (let x = 0; x < size; x++) vertical += difference(x * 4, ((size - 1) * size + x) * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4;
      if (x + 1 < size) { interior += difference(offset, offset + 4); interiorCount++; }
      if (y + 1 < size) { interior += difference(offset, offset + size * 4); interiorCount++; }
    }
    sizes[size] = { horizontalEdgeMae: horizontal / (size * 3), verticalEdgeMae: vertical / (size * 3), interiorNeighborMae: interior / (interiorCount * 3), transparentPixels: [...small].filter((_, i) => i % 4 === 3 && small[i] === 0).length };
    if (subject === 'grass' && size === 64) {
      const tile = await sharp(small, { raw: smallInfo }).png().toBuffer();
      await sharp({ create: { width: size * 3, height: size * 3, channels: 4, background: '#00000000' } }).composite(Array.from({ length: 9 }, (_, i) => ({ input: tile, left: (i % 3) * size, top: Math.floor(i / 3) * size }))).png().toFile(`${prefix}-tiled.png`);
    }
  }
  await writeFile(`${prefix}.processing.json`, JSON.stringify({ pipeline: 'nearest-neighbor without crop; sprites magenta-key; fixed 12-color experimental palette; no seam repair', palette, rawTransparentPixels: rawTransparent, keyedPixels: removed, sizes }, null, 2) + '\n');
}
const samples = [];
for (const spec of models) for (const subject of Object.keys(subjects)) {
  try { samples.push({ option: spec.id, subject, ...JSON.parse(await readFile(`${directory}${spec.id}/${subject}.json`, 'utf8')) }); } catch { /* Missing sample is explicitly absent. */ }
}
await writeFile(`${directory}measurements.json`, JSON.stringify(samples, null, 2) + '\n');
