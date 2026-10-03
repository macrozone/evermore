/** Offline asset generation; never called by the web application. */
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('../public/objects/source/', import.meta.url));
await mkdir(dir, { recursive: true });
const model = 'gemini-3.1-flash-image';
const style = 'Single isolated cozy SNES RPG pixel-art sprite. Axis-aligned top-down south-facing view like Stardew Valley, horizontal and vertical edges, NOT 45-degree isometric. Crisp pixel clusters, warm terracotta, cream, brown timber and muted sage foliage. Light from upper left. Entire object centered with generous empty margin on perfectly flat pure magenta #ff00ff background. No ground, no cast shadow, no text, no labels, no other objects.';
const objects = {
  cottage: 'Small timber cottage with terracotta roof, cream walls, brown timber and golden windows.',
  house: 'Large two-storey timber house with broad terracotta roof, cream walls and golden windows.',
  tree: 'One mature rounded oak tree with muted sage green canopy and sturdy brown trunk.',
  bush: 'One small round leafy shrub with tiny golden flowers.',
  well: 'One round grey stone village well with wooden posts, terracotta canopy and a bucket.',
  fence: 'One straight horizontal three-post wooden fence segment, warm brown timber.',
  lantern: 'One tall wooden lantern post with a softly glowing golden glass lantern.',
};
const token = execFileSync('gcloud', ['auth', 'application-default', 'print-access-token'], { encoding: 'utf8' }).trim();
for (const [id, subject] of Object.entries(objects)) {
  try { await access(`${dir}${id}.png`); console.log(`Keep existing ${id}`); continue; } catch { /* Generate missing assets only. */ }
  const prompt = `${style}\nSubject: ${subject}`;
  const response = await fetch(`https://aiplatform.googleapis.com/v1/projects/maw-evermore/locations/global/publishers/google/models/${model}:generateContent`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1', imageSize: '1K' } } }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${id}: ${response.status} ${JSON.stringify(data)}`);
  const image = data.candidates?.[0]?.content?.parts?.find(part => part.inlineData)?.inlineData;
  if (!image) throw new Error(`No image returned for ${id}`);
  await writeFile(`${dir}${id}.png`, Buffer.from(image.data, 'base64'));
  await writeFile(`${dir}${id}.json`, JSON.stringify({ model, prompt, generatedAt: new Date().toISOString(), usage: data.usageMetadata }, null, 2) + '\n');
  console.log(`Generated ${id}`, data.usageMetadata);
}
