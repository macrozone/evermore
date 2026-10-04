import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

// Start apps/www, then: node scripts/check-r1-depth.mjs http://127.0.0.1:<port>
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:3000");
assert.ok(["127.0.0.1", "localhost"].includes(origin.hostname));
const artifacts = path.resolve(process.argv[3] ?? "docs/lab/screenshots/r1-depth");
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript(() => {
    const api = WebGL2RenderingContext.prototype;
    const textures = new WeakSet();
    for (const name of ["texImage2D", "texSubImage2D"]) {
      const upload = api[name];
      api[name] = function (...args) {
        const source = args.find((arg) => arg instanceof HTMLCanvasElement);
        if (source?.width === 16 && source.height === 32) {
          textures.add(this.getParameter(this.TEXTURE_BINDING_2D));
        }
        return upload.apply(this, args);
      };
    }
    window.r1Probe = { hidePlayer: false, hideBody: false, playerDraws: 0, bodyDraws: 0, frame: 0, pixels: [] };
    for (const name of ["drawElements", "drawArrays"]) {
      const draw = api[name];
      api[name] = function (...args) {
        const probe = window.r1Probe;
        const count = name === "drawElements" ? args[1] : args[2];
        if (count === 6) {
          const active = this.getParameter(this.ACTIVE_TEXTURE);
          this.activeTexture(this.TEXTURE0);
          const player = textures.has(this.getParameter(this.TEXTURE_BINDING_2D));
          this.activeTexture(active);
          if (player) { probe.playerDraws++; if (probe.hidePlayer) return; }
        }
        // The eight-sided player cylinder has 96 indices. Terrain chunks and
        // fixture boxes have different counts. This leaves world shadows intact.
        if (count === 96) { probe.bodyDraws++; if (probe.hideBody) return; }
        draw.apply(this, args);
        if (this.getParameter(this.DRAW_FRAMEBUFFER_BINDING) !== null) return;
        const pixels = new Uint8Array(this.drawingBufferWidth * this.drawingBufferHeight * 4);
        this.readPixels(0, 0, this.drawingBufferWidth, this.drawingBufferHeight, this.RGBA, this.UNSIGNED_BYTE, pixels);
        probe.pixels = pixels;
        probe.frame++;
      };
    }
  });
  assert.ok((await page.goto(new URL("/lab/r1-voxel", origin).href, { timeout: 120000 }))?.ok());
  const surface = page.getByRole("application", { name: "Voxel world movement" });
  const slider = async (name, value) => page.getByRole("slider", { name, exact: true }).fill(String(value));
  await page.waitForFunction(() => document.querySelector('[role="application"]')?.dataset.playerX);
  await page.getByRole("checkbox", { name: "Flicker", exact: true }).uncheck();
  await slider("Camera zoom", 4);
  const forceRender = async () => {
    const frame = await page.evaluate(() => window.r1Probe.frame);
    const follow = page.getByRole("slider", { name: "Camera follow", exact: true });
    await follow.fill((await follow.inputValue()) === "10" ? "11" : "10");
    await page.waitForFunction((before) => window.r1Probe.frame > before, frame);
  };
  const comparePlayer = async (visible, label) => {
    await page.evaluate(() => { window.r1Probe.hidePlayer = false; });
    await forceRender();
    await page.evaluate(() => { window.r1Probe.reference = window.r1Probe.pixels.slice(); window.r1Probe.hidePlayer = true; });
    await forceRender();
    const difference = await page.evaluate(() => {
      const { reference, pixels, playerDraws } = window.r1Probe;
      let changed = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] !== reference[i] || pixels[i + 1] !== reference[i + 1] || pixels[i + 2] !== reference[i + 2]) changed++;
      }
      return { changed, playerDraws };
    });
    assert.ok(difference.playerDraws > 0, "Probe identifies the player texture draw");
    if (visible) assert.ok(difference.changed > 20, `${label}: player changes visible pixels: ${JSON.stringify(difference)}`);
    else assert.equal(difference.changed, 0, `${label}: terrain fully occludes the player`);
    await page.evaluate(() => { window.r1Probe.hidePlayer = false; });
    await forceRender();
    console.log(`${label}: ${JSON.stringify(difference)}`);
  };
  const capture = async (name) => {
    await forceRender();
    await page.getByRole("complementary").evaluate((node) => { node.scrollTop = 0; });
    await surface.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: true });
  };
  const walk = async (code, axis, target, greater) => {
    await surface.focus();
    await page.keyboard.down(code);
    try {
      await page.waitForFunction(({ axis, target, greater }) => {
        const value = Number(document.querySelector('[role="application"]').dataset[`player${axis.toUpperCase()}`]);
        return greater ? value >= target : value <= target;
      }, { axis, target, greater }, { timeout: 30000, polling: "raf" });
    } catch (error) {
      console.error("Failed walk", { code, axis, target, position: await surface.evaluate((node) => ({ ...node.dataset })) });
      throw error;
    } finally { await page.keyboard.up(code); }
    await page.waitForTimeout(1500);
  };
  await page.getByRole("button", { name: "Day", exact: true }).click();
  await comparePlayer(true, "in front of house");
  await capture("house-front-day");
  // Compare with the body omitted from the shadow passes; only the player's
  // directional/local shadow contribution should disappear.
  const compareShadow = async (label) => {
    const shadows = page.getByRole("checkbox", { name: "Cast shadows", exact: true });
    const refresh = async () => { await shadows.uncheck(); await shadows.check(); await forceRender(); };
    await page.evaluate(() => { window.r1Probe.hideBody = false; });
    await refresh();
    await page.evaluate(() => { window.r1Probe.reference = window.r1Probe.pixels.slice(); window.r1Probe.hideBody = true; });
    await refresh();
    const result = await page.evaluate(() => {
      const { pixels, reference, bodyDraws } = window.r1Probe;
      let changed = 0;
      for (let i = 0; i < pixels.length; i += 4) if (Math.abs(pixels[i] - reference[i]) + Math.abs(pixels[i + 1] - reference[i + 1]) + Math.abs(pixels[i + 2] - reference[i + 2]) > 3) changed++;
      return { changed, bodyDraws };
    });
    assert.ok(result.bodyDraws > 0 && result.changed > 0, `${label}: player body casts a shadow: ${JSON.stringify(result)}`);
    await page.evaluate(() => { window.r1Probe.hideBody = false; });
    await refresh();
    console.log(`${label}: ${JSON.stringify(result)}`);
  };
  await page.getByRole("checkbox", { name: "Local lights", exact: true }).uncheck();
  await walk("KeyS", "y", 54.5, true);
  await slider("Time of day", 9);
  await compareShadow("sun shadow");
  await page.getByRole("button", { name: "Night", exact: true }).click();
  await slider("Time of day", 21);
  await compareShadow("moon shadow");
  await page.getByRole("button", { name: "Reset player", exact: true }).click();
  await slider("Moonlight", 0);
  await page.getByRole("checkbox", { name: "Local lights", exact: true }).check();
  await compareShadow("local light shadow");
  await slider("Moonlight", 0.9);
  await capture("house-front-night");
  await page.getByRole("button", { name: "Day", exact: true }).click();
  await slider("Speed", 4);
  await walk("KeyW", "y", 37.5, false);
  await capture("house-inside-day");
  await comparePlayer(false, "inside house behind roof/wall");
  await page.getByRole("button", { name: "Night", exact: true }).click();
  await capture("house-inside-night");
  await page.getByRole("button", { name: "Day", exact: true }).click();
  await page.getByRole("button", { name: "Reset player", exact: true }).click();
  await walk("KeyS", "y", 52.5, true);
  await walk("KeyS", "y", 64.5, true);
  await slider("Speed", 1);
  await walk("KeyD", "x", 29.5, true);
  await walk("KeyS", "y", 66.5, true);
  await comparePlayer(false, "behind tree canopy/trunk");
  await capture("tree-behind-day");
  await page.getByRole("button", { name: "Night", exact: true }).click();
  await capture("tree-behind-night");
  await page.getByRole("button", { name: "Day", exact: true }).click();
  await walk("KeyW", "y", 64.5, false);
  await slider("Speed", 4);
  await walk("KeyD", "x", 37, true);
  await walk("KeyW", "y", 48, false);
  await walk("KeyD", "x", 52, true);
  await walk("KeyW", "y", 29, false);
  await walk("KeyD", "x", 69, true);
  await walk("KeyW", "y", 27, false);
  await slider("Speed", 1);
  await walk("KeyD", "x", 74.5, true);
  await walk("KeyW", "y", 24.5, false);
  // The open doorway correctly reveals the feet. Step onto the first stair
  // behind the solid section of the south wall for full occlusion coverage.
  await walk("KeyA", "x", 73.5, false);
  await capture("tower-inside-day");
  await comparePlayer(false, "inside tower behind wall");
  await page.getByRole("button", { name: "Night", exact: true }).click();
  await capture("tower-inside-night");
  assert.deepEqual(errors, [], "No JavaScript/shader/WebGL errors");
  console.log(`R1 depth and shadow checks passed. Screenshots: ${artifacts}`);
} finally { await browser.close(); }
