/** Headless recovery proof; uses saved maps and never requests model generation. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const { BASE_PORT } = parseEnv(await readFile(new URL('.env.local', root), 'utf8'));
const out = new URL('docs/lab/experiments/heightmap-test/iteration-3/recovery/', root);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
const requests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  if (request.method() === 'POST' && request.url().includes('/api/lab/')) requests.push(request.url());
});
const read = () => page.getByLabel('Settings JSON').inputValue().then(JSON.parse);
const changeRange = async (label, value) => {
  await page.getByLabel(label, { exact: true }).evaluate((input, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await page.waitForTimeout(150);
};
const screenshot = name => page.screenshot({ path: new URL(name, out).pathname, fullPage: true });
const canvas = () => page.locator('canvas');
const nonempty = async () => {
  await page.waitForFunction(() => [...document.querySelectorAll('p')].some(p => /[1-9]\d* triangles/.test(p.textContent)));
  assert.equal(await page.locator('main [role="alert"]').count(), 0);
  assert.equal(await canvas().count(), 1);
};
const download = async (button, filename) => {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: button, exact: true }).click();
  const file = await pending;
  assert.equal(file.suggestedFilename(), filename);
  await file.saveAs(new URL(filename, out).pathname);
};

try {
  await page.goto(`http://localhost:${BASE_PORT}/lab/image-to-voxel`, { waitUntil: 'networkidle' });
  await nonempty();
  assert.equal((await read()).settings.method, 'facade');
  assert.equal(await page.getByLabel('Image model').inputValue(), 'gemini-3.1-flash-lite-image');
  await screenshot('cabin-initial.png');
  console.log('Saved cabin loaded with facade geometry.');
  const initialPixels = await canvas().screenshot();
  await changeRange('Diagnostic turn', 20);
  assert.equal((await read()).camera.rotation, 20);
  assert.notDeepEqual(await canvas().screenshot(), initialPixels);
  await screenshot('cabin-turned.png');
  await page.getByRole('button', { name: 'Reset 2D camera' }).click();
  assert.equal((await read()).camera.rotation, 0);
  let flatPixels;
  for (const height of [0, 12]) {
    await changeRange('Height scale', height);
    assert.equal((await read()).settings.heightScale, height);
    await nonempty();
    const pixels = await canvas().screenshot();
    if (height === 0) flatPixels = pixels;
    else assert.notDeepEqual(pixels, flatPixels);
    await screenshot(`cabin-height-${height}.png`);
  }
  await changeRange('Height scale', 10);
  for (const size of [8, 64]) {
    await changeRange('Tile size', size);
    assert.equal((await read()).settings.tileSize, size);
    await nonempty();
    await screenshot(`cabin-grid-${size}.png`);
  }
  await changeRange('Tile size', 16);
  const noonPixels = await canvas().screenshot();
  await changeRange('Time of day', 6);
  assert.equal((await read()).hour, 6);
  assert.notDeepEqual(await canvas().screenshot(), noonPixels);
  await changeRange('Time of day', 12);
  await download('Save world (.evw)', 'cabin-relief.evw');
  await download('Save settings & cost', 'cabin-relief.json');
  const exported = JSON.parse(await readFile(new URL('cabin-relief.json', out), 'utf8'));
  assert.equal(exported.settings.method, 'facade');
  assert.ok(Object.keys(exported.cellColors).length > 0);
  await download('Save heightmap', 'cabin-top-height.png');
  await download('Save facade mask', 'cabin-facade.png');
  console.log('Facade controls, extremes and exports passed.');
  await page.getByLabel('Test image').selectOption('harbour');
  await page.waitForFunction(() => document.querySelector('textarea')?.value.includes('/harbour.jpg') && document.querySelector('canvas'));
  await nonempty();
  assert.equal((await read()).settings.method, 'heuristic');
  assert.equal(await page.getByRole('button', { name: 'Save facade mask', exact: true }).isDisabled(), true);
  await page.getByLabel('Method', { exact: true }).selectOption('heightmap');
  await nonempty();
  await screenshot('harbour-legacy.png');
  await page.getByLabel('Test image').selectOption('cabin');
  await nonempty();
  await page.getByRole('button', { name: 'Hand masks & Vision comparison', exact: true }).click();
  await nonempty();
  assert.equal((await read()).experiment, 'image-to-voxel-comparison-v1');
  await page.getByRole('button', { name: 'Top heights & facades', exact: true }).click();
  await nonempty();
  assert.equal((await read()).settings.method, 'facade');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-testid="facade-stage"]').evaluate(stage => stage.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(250);
  const layout = await page.evaluate(() => {
    const box = element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    };
    return { stage: box(document.querySelector('[data-testid="facade-stage"]')), controls: box(document.querySelector('fieldset')), canvas: box(document.querySelector('canvas')), width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth };
  });
  assert.ok(layout.scrollWidth <= layout.width);
  assert.ok(layout.stage.top >= 0 && layout.stage.bottom <= layout.height);
  assert.ok(layout.canvas.right <= layout.controls.left + 1);
  assert.ok(layout.canvas.top >= 0 && layout.canvas.bottom <= layout.height);
  await screenshot('mobile-scrolled.png');
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  await writeFile(new URL('facade-proof.json', out), JSON.stringify({ checks: 'Saved cabin facade geometry, pixel/JSON changes, height/grid extremes, lighting, world/maps/settings exports, harbour legacy fallback, mode switching and mobile scroll', layout, errors, modelRequests: requests, additionalModelCostUsd: 0 }, null, 2) + '\n');
  console.log('Facade headless checks passed; no model requests.');
} finally {
  await browser.close();
}
