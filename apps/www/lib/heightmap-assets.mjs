import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GoogleAuth } from 'google-auth-library';

import { HEIGHT_MODELS, HEIGHT_PROMPT } from './heightmap-config.mjs';
export { HEIGHT_MODELS } from './heightmap-config.mjs';
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

export async function generateHeightMaps({ publicDir, source, model, seed = 1 }) {
  const price = HEIGHT_MODELS.find(item => item.id === model);
  if (!price || !['cabin', 'harbour'].includes(source) || !Number.isInteger(seed) || seed < 0 || seed > 2147483647) throw new TypeError('Choose a supported source, model and integer seed.');
  const project = process.env.GOOGLE_CLOUD_PROJECT ?? 'maw-evermore';
  if (!/^[a-z][a-z0-9-]+$/.test(project)) throw new Error('Invalid Vertex project.');
  const bytes = await readFile(join(publicDir, 'image-to-voxel', `${source}.jpg`));
  const metadata = await sharp(bytes).metadata();
  const width = metadata.width, height = metadata.height;
  let timer;
  const credentials = await Promise.race([auth.getRequestHeaders(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Credential lookup timed out; check local ADC.')), 10000); })]).finally(() => clearTimeout(timer));
  const headers = new Headers(credentials);
  headers.set('Content-Type', 'application/json');
  headers.set('x-goog-user-project', project);
  const started = Date.now();
  const usage = [];
  let estimatedCostUsd = 0;
  async function call(prompt) {
    const response = await fetch(`https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${model}:generateContent`, {
      method: 'POST', headers, signal: AbortSignal.timeout(120000),
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: bytes.toString('base64') } }, { text: `${prompt}\nOutput one image at ${width} × ${height}, aspect ratio 16:9.` }] }], generationConfig: { seed, responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9', imageSize: '1K' } } }),
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Vertex HTTP ${response.status} for ${model}; no fallback used.`); }
    const payload = await response.json();
    const image = payload.candidates?.[0]?.content?.parts?.find(part => part.inlineData)?.inlineData;
    if (!image || !['image/png', 'image/jpeg', 'image/webp'].includes(image.mimeType) || typeof image.data !== 'string' || image.data.length > 16000000) throw new Error('Vertex returned no supported image.');
    const tokens = payload.usageMetadata ?? {};
    usage.push(tokens);
    const text = (tokens.thoughtsTokenCount ?? 0) + (tokens.candidatesTokensDetails?.filter(item => item.modality === 'TEXT').reduce((sum, item) => sum + item.tokenCount, 0) ?? 0);
    estimatedCostUsd += price.imageUsd + ((tokens.promptTokenCount ?? 0) * price.inputPerMillion + text * price.textPerMillion) / 1000000;
    return Buffer.from(image.data, 'base64');
  }
  // Sequential to bound memory and preserve a clear record of the two calls.
  const rawHeight = await call(HEIGHT_PROMPT);
  const top = await sharp(rawHeight).resize(width, height, { fit: 'fill', kernel: 'nearest' }).removeAlpha().raw().toBuffer();
  const heights = Buffer.alloc(width * height), mask = Buffer.alloc(width * height);
  for (let i = 0; i < heights.length; i++) {
    const r = top[i * 3], g = top[i * 3 + 1], b = top[i * 3 + 2];
    // Extract the facade from the same label image, so a second model cannot drift.
    mask[i] = r > g + 60 && b > g + 60 ? 255 : 0;
    heights[i] = mask[i] ? 0 : Math.max(0, Math.min(5, Math.round((r + g + b) / 3 / 51))) * 51;
  }
  const encode = data => sharp(data, { raw: { width, height, channels: 1 } }).png().toBuffer();
  return { heightmap: await encode(heights), facade: await encode(mask), rawHeight,
    metadata: { source, model, seed, width, height, generatedAt: new Date().toISOString(), durationMs: Date.now() - started, estimatedCostUsd, usage, prompts: { height: HEIGHT_PROMPT }, normalization: 'nearest resize to source; six grayscale codes; binary facade extracted from magenta; excluded from heights; alignment must be inspected' } };
}
