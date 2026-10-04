import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

// Start apps/www first, then pass its local URL and optionally an artifact directory.
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:3000");
assert.ok(["127.0.0.1", "localhost"].includes(origin.hostname), "Use a local lab server");
const artifacts = path.resolve(process.argv[3] ?? "docs/lab/screenshots/r1-depth-of-field");
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("404")) errors.push(message.text()); });
  await page.addInitScript(() => {
    for (const name of ["drawElements", "drawArrays"]) {
      const original = WebGL2RenderingContext.prototype[name];
      WebGL2RenderingContext.prototype[name] = function (...args) {
        original.apply(this, args);
        if (this.getParameter(this.DRAW_FRAMEBUFFER_BINDING) !== null) return;
        const width = this.drawingBufferWidth;
        const height = this.drawingBufferHeight;
        const pixels = new Uint8Array(width * height * 4);
        this.readPixels(0, 0, width, height, this.RGBA, this.UNSIGNED_BYTE, pixels);
        const program = this.getParameter(this.CURRENT_PROGRAM);
        const uniform = (key) => this.getUniform(program, this.getUniformLocation(program, key));
        let hash = 2166136261;
        let opaque = 0;
        let centerHash = 2166136261;
        let gridErrors = 0;
        const size = uniform("renderSize");
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const color = (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
            hash = Math.imul(hash ^ color, 16777619);
            if (pixels[i + 3] === 255) opaque++;
            // The player's torso sits just above the centered foot anchor.
            if (Math.abs(x - width / 2) <= 2 && y >= height / 2 + 5 && y <= height / 2 + 10) centerHash = Math.imul(centerHash ^ color, 16777619);
            if (x > 0 && Math.floor((x + 0.5) * size[0] / width) === Math.floor((x - 0.5) * size[0] / width)) {
              if (pixels[i] !== pixels[i - 4] || pixels[i + 1] !== pixels[i - 3] || pixels[i + 2] !== pixels[i - 2]) gridErrors++;
            }
          }
        }
        window.r1Frame = { hash, centerHash, gridErrors, opaque: opaque / (width * height), focus: uniform("focusDepth"), expectedFocus: Number(document.querySelector('[role="application"]')?.dataset.focusDepth), enabled: uniform("depthOfField"), strength: uniform("blurStrength"), range: uniform("focusRange") };
      };
    }
  });
  await page.goto(new URL("/lab/r1-voxel", origin).href, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => window.r1Frame);
  const surface = page.getByRole("application", { name: "Voxel world movement" });
  const panel = page.getByRole("complementary", { name: "Voxel experiment settings" });
  const slider = async (name, value) => {
    await page.getByRole("slider", { name, exact: true }).fill(String(value));
    await page.waitForTimeout(150);
  };
  const frame = async () => {
    const value = await page.evaluate(() => window.r1Frame);
    assert.ok(value.opaque > 0.99, "Screen pass covers the canvas");
    assert.equal(value.gridErrors, 0, "Nearest-upscaled pixels remain uniform inside every render pixel");
    assert.ok(Math.abs(value.focus - value.expectedFocus) < 0.001, "Shader receives the current player focus depth");
    return value;
  };
  const capture = (name) => page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: true });
  const dof = page.getByRole("checkbox", { name: "Depth of field", exact: true });
  assert.equal(await dof.isChecked(), false);
  await capture("initial");
  await page.getByRole("checkbox", { name: "Flicker", exact: true }).uncheck();
  await slider("Camera zoom", 1);
  const sharp = await frame();
  await capture("off");
  await dof.check();
  await slider("Focus range", 0.5);
  await slider("Blur strength", 6);
  const blurred = await frame();
  assert.notEqual(blurred.hash, sharp.hash, "Near and far terrain visibly blur");
  assert.equal(blurred.centerHash, sharp.centerHash, "Player torso remains sharp at maximum blur");
  await capture("on");
  await slider("Blur strength", 0);
  assert.equal((await frame()).hash, sharp.hash, "Zero strength restores the exact unblurred image");
  await slider("Blur strength", 6);
  await slider("Focus range", 30);
  assert.notEqual((await frame()).hash, blurred.hash, "Widening the focus band visibly changes which terrain stays sharp");
  await slider("Focus range", 6);
  await slider("Blur strength", 3);
  await capture("moderate");
  await slider("Focus range", 0.5);
  await slider("Blur strength", 6);
  await slider("Camera follow", 1);
  const before = await frame();
  await surface.focus();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(700);
  await page.keyboard.up("KeyW");
  const moved = await frame();
  assert.notEqual(moved.focus, before.focus, "Focus follows player depth while camera follow lags");
  assert.notEqual(moved.hash, before.hash, "Movement still animates the world with depth of field");
  await page.getByRole("button", { name: "Reset player", exact: true }).click();
  await panel.getByText("Settings JSON", { exact: true }).click();
  const settings = JSON.parse(await page.getByRole("textbox", { name: "Settings JSON" }).inputValue());
  assert.equal(settings.look.depthOfField, true);
  assert.equal(settings.look.blurStrength, 6);
  assert.equal(settings.look.focusRange, 0.5);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy settings", exact: true }).click();
  assert.equal(JSON.parse(await page.evaluate(() => navigator.clipboard.readText())).look.depthOfField, true);
  const layout = async () => {
    const world = await surface.boundingBox();
    const controls = await panel.boundingBox();
    assert.ok(world && controls && world.x + world.width <= controls.x, "Panel and world do not overlap");
    for (const box of [world, controls]) assert.ok(box.y < page.viewportSize().height && box.y + box.height > 0, "Both remain visible while controls scroll");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal overflow");
  };
  await slider("Blur strength", 3);
  assert.ok(await panel.evaluate((node) => node.scrollTop > 0));
  await layout();
  const presets = page.getByRole("group", { name: "Camera presets", exact: true }).getByRole("button");
  for (let i = 0; i < await presets.count(); i++) {
    await presets.nth(i).click();
    for (const zoom of [0.5, 8]) {
      await slider("Camera zoom", zoom);
      await frame();
      await layout();
    }
  }
  await presets.nth(0).click();
  await slider("Camera zoom", 1);
  await slider("Time-lapse minutes per second", 120);
  await page.getByRole("button", { name: "Play time-lapse", exact: true }).click();
  const timeStart = (await frame()).hash;
  await page.waitForFunction((previous) => window.r1Frame.hash !== previous, timeStart, { timeout: 15000 });
  assert.notEqual((await frame()).hash, timeStart, "Time-lapse changes actual rendered pixels");
  await page.getByRole("button", { name: "Pause time-lapse", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await surface.scrollIntoViewIfNeeded();
  await slider("Focus range", 6);
  await frame();
  await layout();
  await capture("mobile");
  assert.deepEqual(errors, [], "No JavaScript, shader or WebGL errors");
  console.log(`R1 depth-of-field checks passed: exact off/zero, visible blur, sharp player, pixel grid, moving focus, presets/zoom, JSON/clipboard, scroll/mobile and time. Screenshots: ${artifacts}`);
} finally {
  await browser.close();
}
