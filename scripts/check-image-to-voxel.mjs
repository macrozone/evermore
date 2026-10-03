/** Headless interaction proof. Start apps/www first; uses this worktree's port. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { chromium } from 'playwright';
const root = new URL('../', import.meta.url);
const { BASE_PORT } = parseEnv(await readFile(new URL('.env.local', root), 'utf8'));
const out = new URL('docs/lab/experiments/image-to-voxel/comparison/', root);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = []; page.on('pageerror', e => errors.push(e.message));
const measurements = [];
const read = () => page.getByLabel('Settings JSON').inputValue().then(JSON.parse);
const changeRange = async (label, value) => {
  await page.getByLabel(label, { exact: true }).evaluate((input, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, String(value)); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await page.waitForTimeout(100);
};
const record = async (source, method, geometry, anchors) => {
  await page.getByLabel('Method', { exact: true }).selectOption(method);
  await page.getByLabel('Geometry', { exact: true }).selectOption(geometry);
  await page.getByLabel('Use hand anchors').setChecked(anchors);
  await page.waitForTimeout(150);
  const data = await read();
  assert.equal(data.settings.tileSize, 64);
  assert.ok(Number.isFinite(data.metrics.meanProjectionErrorPx));
  measurements.push({ source, method, geometry, anchors, metrics: data.metrics, model: data.vision }); console.log('Measured',source,method,geometry,anchors);
};
const screenshot = async name => { await page.locator('fieldset').evaluate(el => { el.scrollTop = 0; }); return page.screenshot({ path: new URL(name, out).pathname, fullPage: true }); };
try {
  await page.goto(`http://127.0.0.1:${BASE_PORT}/lab/image-to-voxel?experiment=comparison`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('textarea')?.value.includes('meanProjectionErrorPx'));
  for (const source of ['cabin', 'harbour']) {
    console.log('Scene',source);
    await page.getByLabel('Test image').selectOption(source);
    await page.waitForFunction(source => {
      const data = JSON.parse(document.querySelector('textarea').value);
      return data.source.endsWith(`${source}.jpg`) && data.vision?.model && data.metrics;
    }, source, { timeout: 15000 });
    await page.waitForTimeout(250);
    for (const method of ['heuristic', 'heightmap', 'vision']) {
      await record(source, method, 'relief', false);
      await record(source, method, 'projected', false);
      await record(source, method, 'projected', true);
    }
    await page.getByLabel('Method', { exact: true }).selectOption('heightmap');
    await page.getByLabel('Geometry').selectOption('relief');
    await page.getByLabel('Source view').selectOption('source');
    await page.waitForTimeout(250); await screenshot(`${source}-baseline.png`);
    await page.getByLabel('Method', { exact: true }).selectOption('vision');
    await page.getByLabel('Geometry').selectOption('projected');
    await page.waitForTimeout(250); await screenshot(`${source}-projected.png`);
    await page.getByRole('button', { name: 'Start correction timer' }).click();
    await page.getByLabel('Patch', { exact: true }).selectOption('roof');
    await changeRange('Ground contact Y', source === 'cabin' ? 60 : 50);
    await changeRange('Patch level', 5);
    await page.getByRole('button', { name: 'Mask ↓' }).click();
    await page.getByRole('button', { name: 'Stop correction timer' }).click();
    const corrected = await read();
    const run = corrected.corrections.at(-1);
    assert.equal(run.edits, 3); assert.ok(run.durationMs > 0);
    await writeFile(new URL(`${source}-correction-smoke.json`, out), JSON.stringify(run, null, 2) + '\n');
    await page.getByRole('button', { name: 'Reset patches' }).click();
    const worldDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save world (.evw)', exact: true }).click();
    assert.equal((await worldDownload).suggestedFilename(), `${source}-projected.evw`);
    const jsonDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save comparison JSON', exact: true }).click();
    await (await jsonDownload).saveAs(new URL(`${source}-export.json`, out).pathname);
  }
  // Changing controls must affect both actual pixel output and serialized settings.
  console.log('Checking extremes and pixels');
  const canvas = page.locator('canvas'); const before = await canvas.screenshot();
  await changeRange('Diagnostic turn', 20);
  assert.notDeepEqual(await canvas.screenshot(), before);
  await page.getByRole('button', { name: 'Reset 2D camera' }).click();
  assert.equal((await read()).camera.rotation, 0);
  let flatPixels;
  for (const scale of [0, 12]) {
    await changeRange('Height scale', scale); assert.equal((await read()).settings.heightScale, scale);
    const pixels = await canvas.screenshot();
    if (scale === 0) flatPixels = pixels; else assert.notDeepEqual(pixels, flatPixels);
    await screenshot(`harbour-height-${scale}.png`);
  }
  await changeRange('Height scale', 6);
  await page.getByLabel('Method', { exact: true }).selectOption('heightmap');
  for (const size of [8,64]) { await changeRange('Tile size', size); assert.equal((await read()).settings.tileSize, size); await screenshot(`harbour-grid-${size}.png`); }
  const noonPixels = await canvas.screenshot();
  await changeRange('Time of day', 6); assert.notDeepEqual(await canvas.screenshot(), noonPixels);
  await changeRange('Time of day', 12);
  await page.getByLabel('Source view').selectOption('heightmap');
  await screenshot('harbour-heightmap.png');
  await page.getByLabel('Source view').selectOption('vision');
  await screenshot('harbour-vision-tiles.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-testid="comparison-stage"]').scrollIntoViewIfNeeded();
  await page.evaluate(() => document.querySelector('[data-testid="comparison-stage"]').scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(250);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const boxes = await page.evaluate(() => {
    const stage = document.querySelector('[data-testid="comparison-stage"]').getBoundingClientRect();
    const controls = document.querySelector('fieldset').getBoundingClientRect();
    const canvas = document.querySelector('canvas').getBoundingClientRect();
    return { stage: { top: stage.top, bottom: stage.bottom }, controls: { left: controls.left }, canvas: { right: canvas.right, top: canvas.top, bottom: canvas.bottom } };
  });
  assert.ok(boxes.stage.top >= 0 && boxes.stage.bottom <= 844);
  assert.ok(boxes.canvas.right <= boxes.controls.left + 1);
  assert.ok(boxes.canvas.top >= 0 && boxes.canvas.bottom <= 844);
  await screenshot('mobile-scrolled.png');
  assert.deepEqual(errors, []);
  await writeFile(new URL('measurements.json', out), JSON.stringify({ generatedAt: new Date().toISOString(), protocol: 'Two fixed 1376x768 sources, 64px grid, heightScale 6, camera 45deg/0deg, noon; one cached successful response per source. Correction timing is automated interaction smoke evidence, not human editing time.', measurements }, null, 2) + '\n');
  console.log('Image-to-voxel headless checks passed:', measurements.length, 'comparison rows, timer, masks, anchors, pixels, extremes, exports, mobile scroll.');
} finally { await browser.close(); }
