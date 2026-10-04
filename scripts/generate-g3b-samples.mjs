import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = new URL(process.argv[2] ?? 'http://127.0.0.1:8480');
assert.ok(['localhost', '127.0.0.1'].includes(origin.hostname));
const destination = 'apps/www/public/g3b-map';
await mkdir(destination, { recursive: true });
for (const source of ['cabin', 'harbour']) {
  for (const approach of ['vision', 'image']) {
    const model = approach === 'image' ? 'gemini-3.1-flash-lite-image' : 'gemini-3.5-flash-lite';
    const response = await fetch(new URL('/api/lab/g3b-map', origin), {
      method: 'POST', headers: { 'Content-Type': 'application/json', origin: origin.origin },
      body: JSON.stringify({ source, approach, model }), signal: AbortSignal.timeout(150_000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`${source}/${approach}: ${response.status} ${data.error}`);
    await writeFile(`${destination}/${source}-${approach}.json`, JSON.stringify(data.result, null, 2));
    console.log(source, approach, data.durationMs, data.requestCostUsd);
  }
}
