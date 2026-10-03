import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

// Start apps/www first: pnpm test:r1-zoom http://127.0.0.1:<BASE_PORT> [artifact-directory]
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:3000");
assert.ok(["127.0.0.1", "localhost"].includes(origin.hostname), "Use a local lab server");
const artifacts = path.resolve(process.argv[3] ?? "docs/lab/screenshots/r1-zoom-check");
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => {
    let pending;
    // Observe the actual default-framebuffer draw. Reading in a later RAF can
    // see a discarded buffer because Three.js does not preserveDrawingBuffer.
    for (const name of ["drawElements", "drawArrays"]) {
      const original = WebGL2RenderingContext.prototype[name];
      WebGL2RenderingContext.prototype[name] = function (...args) {
        original.apply(this, args);
        if (!pending || this.getParameter(this.DRAW_FRAMEBUFFER_BINDING) !== null) return;
        const { resolve, timer } = pending;
        pending = undefined;
        clearTimeout(timer);
        const width = this.drawingBufferWidth;
        const height = this.drawingBufferHeight;
        const pixels = new Uint8Array(width * height * 4);
        this.readPixels(0, 0, width, height, this.RGBA, this.UNSIGNED_BYTE, pixels);
        let opaque = 0;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] === 255) opaque++;
        let detailedRows = 0;
        // The sky is a vertical gradient. Several colours along a horizontal
        // row prove that terrain, rather than only the sky, reached the screen.
        for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 32))) {
          const colours = new Set();
          for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 64))) {
            const i = (y * width + x) * 4;
            colours.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]);
          }
          if (colours.size >= 4) detailedRows++;
        }
        resolve({ width, height, opaqueFraction: opaque / (width * height), detailedRows });
      };
    }
    window.readR1Screen = () => new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending = undefined;
        reject(new Error("No screen-pass draw within 5 seconds (fullscreen quad may be culled)"));
      }, 5000);
      pending = { resolve, timer };
    });
  });
  const response = await page.goto(new URL("/lab/r1-voxel", origin).href, { waitUntil: "load", timeout: 120000 });
  assert.ok(response?.ok(), "Lab route loads successfully");
  const surface = page.getByRole("application", { name: "Voxel world movement" });
  const panel = page.getByRole("complementary", { name: "Voxel experiment settings" });
  await page.waitForFunction(() => document.querySelector('[role="application"]')?.dataset.playerX);
  const checkScreen = async (label) => {
    // Let React's effect apply the control change before probing the next draw.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const sample = await page.evaluate(() => window.readR1Screen());
    assert.ok(sample.width > 100 && sample.height > 100, `${label}: canvas has a useful size`);
    assert.ok(sample.opaqueFraction > 0.99, `${label}: screen pass covers the canvas (${JSON.stringify(sample)})`);
    assert.ok(sample.detailedRows >= 4, `${label}: world detail remains visible (${JSON.stringify(sample)})`);
    console.log(`${label}: ${JSON.stringify(sample)}`);
  };
  const capture = (name) => page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: true });
  const zoom = page.getByRole("slider", { name: "Camera zoom", exact: true });
  const setZoom = async (value) => {
    await zoom.fill(String(value));
    assert.equal(await zoom.inputValue(), String(value));
    await page.getByText(`Zoom (${value.toFixed(2)}×)`, { exact: true }).waitFor();
  };
  await checkScreen("initial player camera");
  await capture("initial");
  // Discover every preset from the UI so added presets receive the same coverage.
  const presets = page.getByRole("group", { name: "Camera presets", exact: true }).getByRole("button");
  const labels = await presets.allTextContents();
  assert.ok(labels.length >= 3, "Camera presets are available");
  const zooms = [0.5, 1, 1.65, 1.7, 1.75, 2.2, 3];
  for (let i = 0; i < labels.length; i++) {
    await presets.nth(i).click();
    assert.equal(await presets.nth(i).getAttribute("aria-pressed"), "true");
    await checkScreen(`${labels[i]} after preset switch`);
    for (const value of zooms) {
      await setZoom(value);
      await checkScreen(`${labels[i]} at ${value}x`);
      if ([0.5, 1.75, 3].includes(value)) await capture(`preset-${i}-zoom-${value}`);
    }
  }
  await presets.nth(0).click();
  await setZoom(1.75);
  await zoom.scrollIntoViewIfNeeded();
  assert.ok(await panel.evaluate((node) => node.scrollTop > 0), "Camera controls scroll inside the panel");
  const assertLayout = async () => {
    const worldBox = await surface.boundingBox();
    const panelBox = await panel.boundingBox();
    assert.ok(worldBox && panelBox && worldBox.x + worldBox.width <= panelBox.x, "Controls do not overlap the world");
    for (const box of [worldBox, panelBox]) {
      assert.ok(box.y < page.viewportSize().height && box.y + box.height > 0, "World and controls stay in view after scrolling");
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal overflow");
  };
  await assertLayout();
  await checkScreen("after scrolling camera controls");
  await page.mouse.move(100, 300);
  await page.mouse.wheel(0, 500);
  await page.waitForFunction(() => scrollY > 0);
  await assertLayout();
  await checkScreen("after scrolling page");
  await capture("scrolled-1.75");
  await page.setViewportSize({ width: 390, height: 844 });
  await surface.scrollIntoViewIfNeeded();
  for (const value of [0.5, 1.75, 3]) {
    await setZoom(value);
    await assertLayout();
    await checkScreen(`mobile at ${value}x`);
  }
  await capture("mobile-3");
  assert.deepEqual(errors, [], "No browser, shader or WebGL errors");
  console.log(`R1 zoom checks passed. Screenshots: ${artifacts}`);
} finally {
  await browser.close();
}
