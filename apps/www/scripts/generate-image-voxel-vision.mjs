/** Offline, explicit generation only; cached proposals are validated again in the browser. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseVisionProposal, VISION_SCHEMA } from '../app/lab/image-to-voxel/vision.ts';
const sourceId = process.argv[2];
if (!['cabin', 'harbour'].includes(sourceId)) throw new Error('Usage: node --experimental-strip-types scripts/generate-image-voxel-vision.mjs cabin|harbour [model]');
const model = process.argv[3] ?? 'gemini-3.5-flash-lite';
if (!/^gemini-[a-z0-9.-]+$/.test(model)) throw new Error('Invalid model');
const dir = fileURLToPath(new URL('../public/image-to-voxel/', import.meta.url));
const image = await readFile(`${dir}${sourceId}.jpg`);
const expected = { sourceId, width: 1376, height: 768, tileSize: 64 };
const schema = { ...VISION_SCHEMA, required: ['sourceId', 'width', 'height', 'tileSize', 'rows'], properties: { sourceId: VISION_SCHEMA.properties.sourceId, width: VISION_SCHEMA.properties.width, height: VISION_SCHEMA.properties.height, tileSize: VISION_SCHEMA.properties.tileSize, rows: { type: 'array', items: { type: 'array', items: { type: 'object', required: ['level', 'region'], additionalProperties: false, properties: { level: VISION_SCHEMA.properties.tiles.items.properties.level, region: VISION_SCHEMA.properties.tiles.items.properties.region } } } } } };
const prompt = `Estimate discrete WORLD HEIGHT above water, not camera depth or brightness, for every tile in this exact RPG image. Grid starts at top-left (0,0), tile size 64 pixels, source 1376x768: 22 columns x 12 rows, including a partial last column. Coordinates x=0..21, y=0..11, one entry per tile. Classify tile centre: roof, wall (including gables), bridge (including docks), water, other or unknown. Height levels: 0 water, 1 ground, 2 low deck/bridge/objects, 3 walls, 4 roofs/crowns, 5 highest chimney/ridge. Walls may vary vertically; light and shadows are not height. Water MUST be level 0 and bridge/dock MUST be above water. Return rows: exactly 12 row arrays in top-to-bottom order, each with exactly 22 tile objects {level,region} in left-to-right order. All 264 tiles; no coordinate fields. Do not use a tile's screen location as a ground footprint. sourceId=${sourceId}, width=1376, height=768, tileSize=64. These are unverified height proposals, not playable geometry.`;
const token = execFileSync('gcloud', ['auth', 'application-default', 'print-access-token'], { encoding: 'utf8' }).trim();
const started = Date.now();
const response = await fetch(`https://aiplatform.googleapis.com/v1/projects/maw-evermore/locations/global/publishers/google/models/${model}:generateContent`, {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: image.toString('base64') } }] }], generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, maxOutputTokens: 16384, thinkingConfig: { thinkingLevel: model === 'gemini-3.8-flash' ? 'LOW' : 'MINIMAL' } } }),
  signal: AbortSignal.timeout(120000),
});
const data = await response.json();
if (!response.ok) throw new Error(`Vertex HTTP ${response.status}: ${data.error?.message ?? 'request failed'}`);
if (data.candidates?.[0]?.finishReason !== 'STOP') throw new Error('Incomplete model response');
const text = data.candidates[0].content.parts.filter(p => !p.thought).map(p => p.text ?? '').join('');
let proposal;
try {
  const matrix = JSON.parse(text);
  if (!Array.isArray(matrix.rows) || matrix.rows.length !== 12 || matrix.rows.some(row => !Array.isArray(row) || row.length !== 22 || row.some(t => !t || Object.keys(t).length !== 2 || !Object.hasOwn(t, 'level') || !Object.hasOwn(t, 'region')))) throw new Error('Expected 12 rows of 22 tiles');
  const { rows, ...header } = matrix;
  proposal = parseVisionProposal({ ...header, tiles: rows.flatMap((row, y) => row.map((t, x) => ({ ...t, x, y }))) }, expected);
}
catch (error) {
  await writeFile(`${dir}${sourceId}-vision-rejected.json`, JSON.stringify({ error: error.message, model, durationMs: Date.now() - started, usage: data.usageMetadata, prompt, response: text }, null, 2) + '\n');
  throw error;
}
const output = { proposal, provenance: { model, provider: 'Vertex AI', sourceSha256: createHash('sha256').update(image).digest('hex'), generatedAt: new Date().toISOString(), durationMs: Date.now() - started, usage: data.usageMetadata, costUsd: null, prompt } };
await writeFile(`${dir}${sourceId}-vision.json`, JSON.stringify(output, null, 2) + '\n');
console.log(`${sourceId}: validated ${proposal.tiles.length} tiles`, output.provenance.durationMs, 'ms', data.usageMetadata);
