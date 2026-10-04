import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Run against an already-running local app: node scripts/check-forest-cottage.mjs http://127.0.0.1:4110
const origin = new URL(process.argv[2] ?? 'http://127.0.0.1:3000');
assert(['127.0.0.1', 'localhost'].includes(origin.hostname), 'Use a local app');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('/lab/r2-tilemap', origin).href);
  const surface = page.getByRole('application', { name: 'Forest cottage movement' });
  await page.waitForFunction(() => document.querySelector('[data-player-x]'));
  await page.waitForFunction(() => { const image = document.querySelector('img[alt^="Forest cottage moodboard"]'); return image?.complete && image.naturalWidth > 0; });
  const position = () => surface.evaluate(element => ({ x: Number(element.dataset.playerX), y: Number(element.dataset.playerY), faded: Number(element.dataset.faded) }));
  const walk = async (key, ms) => {
    await surface.focus();
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
  };
  await walk('KeyW', 1200);
  assert((await position()).y < 13, 'Enter through the doorway');
  assert((await position()).faded > 0, 'Roof fades above the player');
  await page.getByLabel('Fade occluders', { exact: true }).uncheck();
  await page.waitForTimeout(100);
  assert.equal((await position()).faded, 0);
  await page.getByLabel('Fade occluders', { exact: true }).check();
  await page.getByRole('button', { name: 'Reset player' }).click();
  await page.waitForTimeout(150);
  await walk('KeyS', 2000);
  assert((await position()).y > 21, 'Bridge crosses the water');
  await page.getByRole('button', { name: 'Reset player' }).click();
  await page.waitForTimeout(150);
  await walk('KeyA', 1800);
  await walk('KeyS', 1700);
  assert((await position()).y < 19, 'River stops the player away from the bridge');
  await page.getByRole('button', { name: 'Reset player' }).click();
  await page.waitForTimeout(150);
  await walk('KeyA', 2650);
  await walk('KeyW', 1100);
  assert((await position()).faded > 0, 'Tree crown fades when walking underneath');
  const canvas = surface.locator('canvas');
  const pixels = () => canvas.evaluate(element => element.toDataURL());
  const day = await pixels();
  await page.getByLabel('Tile grid', { exact: true }).check();
  await page.waitForTimeout(100);
  const gridPixels = await pixels();
  assert.notEqual(gridPixels, day, 'Grid changes the rendering');
  await page.getByLabel('Night amount').fill('1');
  await page.waitForTimeout(100);
  assert.notEqual(await pixels(), gridPixels, 'Evening lighting changes the rendering');
  for (const layer of ['ground', 'decoration', 'objects', 'facade', 'overhead', 'light']) {
    const before = await pixels();
    await page.getByLabel(layer, { exact: true }).uncheck();
    await page.waitForTimeout(100);
    assert.notEqual(await pixels(), before, `Layer ${layer} changes the rendering`);
    await page.getByLabel(layer, { exact: true }).check();
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => window.scrollTo(0, 400));
  const controls = await page.getByRole('group', { name: 'Cottage controls' }).boundingBox();
  assert(controls && controls.y >= 0 && controls.y + controls.height < 1000, 'Controls stay visible while scrolling');
  await page.getByLabel('Scene', { exact: true }).selectOption('meadow');
  await page.waitForFunction(() => document.querySelector('canvas'));
  const diagnosticPosition = page.getByText('Position:', { exact: true }).locator('..').locator('dd');
  await page.waitForTimeout(500);
  const oldDiagnostics = await diagnosticPosition.textContent();
  const legacySurface = page.locator('[tabindex="0"]').first();
  await legacySurface.focus();
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(800);
  await page.keyboard.up('KeyD');
  assert.notEqual(await diagnosticPosition.textContent(), oldDiagnostics, 'Legacy scene remains interactive after switching');
  await page.getByLabel('Scene', { exact: true }).selectOption('moodboard');
  await page.waitForFunction(() => document.querySelector('[data-player-x]'));
  await walk('KeyD', 400);
  assert((await position()).x > 22, 'Movement works after returning to the cottage');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 500));
  const mobileControls = await page.getByRole('group', { name: 'Cottage controls' }).boundingBox();
  assert(mobileControls && mobileControls.y >= 0 && mobileControls.y + mobileControls.height < 844, 'Mobile controls stay visible');
  assert.deepEqual(errors, []);
  console.log('Forest cottage: reference, door/roof, bridge/river, canopy, controls, scrolling and scene switching passed.');
} finally {
  await browser.close();
}
