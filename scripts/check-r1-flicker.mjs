import assert from "node:assert/strict";
import { chromium } from "playwright";

// Start apps/www first: pnpm test:r1-flicker http://localhost:<BASE_PORT>
const origin = new URL(process.argv[2] ?? "http://localhost:3000");
assert.ok(["127.0.0.1", "localhost"].includes(origin.hostname), "Use a local lab server");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript(() => {
    const names = new WeakMap();
    const colours = {};
    const getUniformLocation = WebGL2RenderingContext.prototype.getUniformLocation;
    WebGL2RenderingContext.prototype.getUniformLocation = function (program, name) {
      const location = getUniformLocation.call(this, program, name);
      if (location) names.set(location, name);
      return location;
    };
    const uniform3f = WebGL2RenderingContext.prototype.uniform3f;
    WebGL2RenderingContext.prototype.uniform3f = function (location, r, g, b) {
      const name = names.get(location);
      if (/^pointLights\[\d+\]\.color$/.test(name ?? "")) colours[name] = [r, g, b];
      return uniform3f.call(this, location, r, g, b);
    };
    window.r1FlickerProbe = { active: false, samples: [] };
    const drawElements = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function (...args) {
      drawElements.apply(this, args);
      const probe = window.r1FlickerProbe;
      const now = performance.now();
      if (!probe.active || this.getParameter(this.DRAW_FRAMEBUFFER_BINDING) !== null) return;
      if (now - (probe.samples.at(-1)?.now ?? 0) < 200) return;
      // Read during the screen draw: the buffer can be discarded before a later RAF.
      const pixels = new Uint8Array(this.drawingBufferWidth * this.drawingBufferHeight * 4);
      this.readPixels(0, 0, this.drawingBufferWidth, this.drawingBufferHeight, this.RGBA, this.UNSIGNED_BYTE, pixels);
      let hash = 2166136261;
      for (let i = 0; i < pixels.length; i += 16) {
        for (let channel = 0; channel < 3; channel++) hash = Math.imul(hash ^ pixels[i + channel], 16777619);
      }
      const hud = [...document.querySelectorAll("p")].find((node) => node.textContent.includes(" fps ·"))?.textContent;
      probe.samples.push({ now, hash: hash >>> 0, colours: structuredClone(colours), hud });
      if (probe.samples.length >= 12) probe.active = false;
    };
  });
  const response = await page.goto(new URL("/lab/r1-voxel", origin).href, { timeout: 120000 });
  assert.ok(response?.ok(), "Lab route loads successfully");
  const surface = page.getByRole("application", { name: "Voxel world movement" });
  await page.waitForFunction(() => document.querySelector('[role="application"]')?.dataset.playerX);
  const canvas = surface.locator("canvas");
  const originalCanvas = await canvas.elementHandle();
  const position = await surface.evaluate((node) => ({ ...node.dataset }));
  assert.equal(await page.getByRole("slider", { name: "Flicker strength", exact: true }).inputValue(), "0.12");
  assert.equal(await page.getByRole("slider", { name: "Flicker speed", exact: true }).inputValue(), "2");
  assert.ok(await page.getByRole("checkbox", { name: "Flicker", exact: true }).isChecked());
  await page.evaluate(() => { window.r1FlickerProbe.active = true; });
  // No controls or movement input: only the renderer's own clock can drive these frames.
  await page.waitForFunction(() => {
    const samples = window.r1FlickerProbe.samples;
    return samples.length >= 8 && samples.at(-1).now - samples[0].now >= 2000;
  }, null, { timeout: 30000 });
  const samples = await page.evaluate(() => {
    window.r1FlickerProbe.active = false;
    return window.r1FlickerProbe.samples;
  });
  for (const index of [0, 4]) {
    const values = samples.map((sample) => sample.colours[`pointLights[${index}].color`]?.[0]);
    assert.ok(values.every(Number.isFinite), `Fire ${index} reaches the WebGL shader`);
    assert.ok(Math.max(...values) - Math.min(...values) > 0.01, `Fire ${index} intensity changes over idle ticks`);
  }
  for (const index of [1, 2, 3]) {
    const values = samples.map((sample) => sample.colours[`pointLights[${index}].color`]?.[0]);
    assert.ok(values.every(Number.isFinite), `Steady light ${index} reaches the WebGL shader`);
    assert.equal(new Set(values).size, 1, `Lantern/window ${index} remains steady`);
  }
  assert.ok(new Set(samples.map((sample) => sample.hash)).size >= 3, "Default firelight changes displayed pixels without interaction");
  const hudUpdates = [...new Set(samples.map((sample) => sample.hud))];
  assert.ok(hudUpdates.filter((hud) => Number(hud?.match(/· ([\d.]+) fps/)?.[1]) > 0).length >= 2, "FPS measurements keep updating while idle");
  assert.ok(await originalCanvas.evaluate((node) => node.isConnected), "HUD updates preserve the renderer's canvas");
  assert.deepEqual(await surface.evaluate((node) => ({ ...node.dataset })), position, "Player remains stationary");
  assert.deepEqual(errors, [], "No browser, shader or WebGL errors");
  console.log(`R1 idle flicker passed: ${samples.length} frames, ${new Set(samples.map((sample) => sample.hash)).size} pixel hashes, ${hudUpdates.length} HUD updates.`);
} finally {
  await browser.close();
}
