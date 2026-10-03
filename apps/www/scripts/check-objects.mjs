/** Headless interaction check with fixture responses; no paid image requests. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = 30424;
const origin = `http://127.0.0.1:${port}`;
const server = spawn('pnpm', ['exec', 'next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: new URL('../', import.meta.url), stdio: 'pipe', detached: true });
let logs = '';
server.stdout.on('data', data => { logs += data; });
server.stderr.on('data', data => { logs += data; });
let browser;
try {
  const started = Date.now();
  while (true) {
    try { const response = await fetch(origin); await response.body?.cancel(); break; } catch { /* Wait for this isolated server. */ }
    if (server.exitCode !== null || Date.now() - started > 90_000) throw new Error(`Development server failed: ${logs}`);
    await delay(250);
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/lab/objects`);
  // Check the actual Next route (including Next-injected forwarded headers).
  const budget = await page.evaluate(async () => {
    const response = await fetch('/api/lab/objects');
    return { status: response.status, body: await response.json() };
  });
  if (budget.status !== 200) console.log(logs);
  assert.equal(budget.status, 200);
  assert.equal(budget.body.rate.limit, 20);
  await page.getByRole('button', { name: 'Generate 2 variants' }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('button[type=submit]').disabled);
  const raw = `data:image/png;base64,${(await readFile(new URL('../public/objects/source/well.png', import.meta.url))).toString('base64')}`;
  const sprite = `data:image/png;base64,${(await readFile(new URL('../public/objects/well.png', import.meta.url))).toString('base64')}`;
  let calls = 0, submitted;
  await page.route('**/api/lab/objects', async route => {
    if (route.request().method() === 'GET') return route.continue();
    calls++;
    submitted = route.request().postDataJSON();
    if (calls > 1) return route.fulfill({ status: 429, json: { error: 'Not enough image calls remain for these variants.', rate: { used: 20, limit: 20, resetsAt: Date.now() + 3_600_000 } } });
    const objects = Array.from({ length: submitted.variants }, (_, i) => ({
      id: `qa-object-${i}`, name: submitted.prompt, prompt: submitted.prompt, seed: submitted.seed + i, model: submitted.model,
      kind: submitted.kind, width: 16 * submitted.widthTiles, height: 16 * submitted.heightTiles,
      footprint: { columns: 1, rows: 1, occupied: [[0, 0]], collision: [[0, 0]] }, heightTiles: 1,
      raw, sprite, durationMs: 1500, estimatedCostUsd: 0.034, generatedAt: new Date().toISOString(), footprintSource: 'heuristic', pixelSize: submitted.pixelSize, palette: submitted.palette,
    }));
    await route.fulfill({ json: { objects, errors: [], durationMs: 1500, estimatedCostUsd: 0.136, cached: false, rate: { used: 4, limit: 20, resetsAt: Date.now() + 3_600_000 } } });
  });
  await page.getByLabel('Object description').fill('A tiny mossy well');
  await page.getByLabel('Image model').selectOption('gemini-3-pro-image');
  await page.getByLabel('Object kind').selectOption('building');
  await page.getByLabel('Specify sprite size').check();
  await page.getByLabel('Width in tiles').fill('1');
  await page.getByLabel('Height in tiles').fill('8');
  await page.getByLabel('Seed', { exact: true }).fill('2147483643');
  await page.getByLabel('Variants').fill('4');
  await page.getByLabel('Pixel size').fill('4');
  await page.getByRole('combobox', { name: /^Palette/ }).selectOption('dusk');
  await page.getByLabel('Display scale').fill('4');
  await page.getByLabel('Show collision footprints').check();
  await page.getByRole('button', { name: 'Generate 4 variants' }).click();
  await page.getByRole('heading', { name: 'Latest variants' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Add to local library' }).count(), 4);
  assert.equal(await page.getByRole('img', { name: 'Raw A tiny mossy well' }).count(), 4);
  assert.deepEqual(submitted, { prompt: 'A tiny mossy well', model: 'gemini-3-pro-image', kind: 'building', seed: 2147483643, variants: 4, pixelSize: 4, palette: 'dusk', widthTiles: 1, heightTiles: 8 });
  await page.getByRole('button', { name: 'Add to local library' }).first().click();
  await page.getByRole('button', { name: 'Saved locally' }).waitFor();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download metadata' }).first().click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'qa-object-0.json');
  const metadata = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(metadata.footprintSource, 'heuristic');
  assert.equal(metadata.sprite, 'qa-object-0.png');
  const pngPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download PNG' }).first().click();
  assert.equal((await pngPromise).suggestedFilename(), 'qa-object-0.png');
  await page.reload();
  await page.getByRole('heading', { name: 'Local library', exact: true }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'A tiny mossy well' }).count(), 1);
  const results = page.getByRole('region', { name: 'Object results' });
  await results.evaluate(element => { element.scrollTop = element.scrollHeight; });
  const checkVisiblePanes = async () => {
    const controlsBox = await page.getByRole('complementary', { name: 'Object controls' }).boundingBox();
    const resultsBox = await results.boundingBox();
    const viewport = page.viewportSize();
    for (const box of [controlsBox, resultsBox]) {
      assert.ok(box && box.width > 100 && box.height > 100 && box.y >= 0 && box.y + box.height <= viewport.height + 1);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  };
  await checkVisiblePanes();
  await page.setViewportSize({ width: 390, height: 844 });
  await checkVisiblePanes();
  await page.getByRole('button', { name: 'Generate 2 variants' }).click();
  await page.getByRole('alert').filter({ hasText: 'Not enough image calls' }).waitFor();
  assert.ok((await page.getByRole('status').allTextContents()).some(text => text.includes('20 / 20')));
  assert.deepEqual(errors, []);
  console.log('Object lab headless check passed: real local route, four variants, extreme settings, PNG/metadata downloads, persisted local library, desktop/mobile scrolling, rate-limit feedback.');
} finally {
  await browser?.close();
  try { process.kill(-server.pid, 'SIGTERM'); } catch { /* Already stopped. */ }
}
