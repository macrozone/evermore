import assert from "node:assert/strict";
import { chromium } from "playwright";

// Start apps/www first, then run: node scripts/check-r1-player.mjs http://127.0.0.1:<BASE_PORT>
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:3000");
assert.ok(["127.0.0.1", "localhost"].includes(origin.hostname), "Use a local lab server");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("404")) errors.push(message.text()); });
  await page.goto(new URL("/lab/r1-voxel", origin).href);
  const surface = page.getByRole("application", { name: "Voxel world movement" });
  await page.waitForFunction(() => document.querySelector('[role="application"]')?.dataset.playerX);
  const position = () => surface.evaluate((node) => ({ x: Number(node.dataset.playerX), y: Number(node.dataset.playerY), z: Number(node.dataset.playerZ) }));
  const slider = async (name, value) => {
    const input = page.getByRole("slider", { name, exact: true });
    await input.scrollIntoViewIfNeeded();
    await input.fill(String(value));
    await input.dispatchEvent("input");
  };
  // Reading immediately after a render verifies an opaque, non-empty screen pass.
  assert.ok(await surface.locator("canvas").evaluate((canvas) => new Promise((resolve) => {
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    const gl = canvas.getContext("webgl2");
    let attempts = 0;
    const check = () => {
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      if (pixels.some((value, index) => index % 4 === 3 && value > 0)) resolve(true);
      else if (++attempts >= 60) resolve(false);
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  })), "Canvas must contain the world instead of a blank camera pass");
  const walkUntil = async (code, axis, target, greater) => {
    await surface.focus();
    await page.keyboard.down(code);
    try {
      await page.waitForFunction(({ axis, target, greater }) => {
        const value = Number(document.querySelector('[role="application"]').dataset[`player${axis.toUpperCase()}`]);
        return greater ? value >= target : value <= target;
      }, { axis, target, greater }, { timeout: 15000, polling: "raf" });
    } finally { await page.keyboard.up(code); }
    await page.waitForTimeout(150);
  };
  await walkUntil("KeyW", "y", 37.5, false);
  assert.equal((await position()).z, 3);
  await walkUntil("ArrowRight", "x", 19, true);
  await walkUntil("ArrowUp", "y", 31.8, false);
  await walkUntil("KeyD", "x", 23.5, true);
  assert.equal((await position()).z, 6, "Kitchen stairs reach the upper floor");
  await page.screenshot({ path: "docs/lab/screenshots/r1-player-upstairs.png", fullPage: true });
  await walkUntil("KeyA", "x", 19, false);
  assert.equal((await position()).z, 3, "Stairs also descend");
  await page.getByRole("button", { name: "Reset player", exact: true }).click();
  await surface.focus();
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(250);
  await page.getByRole("slider", { name: "Speed", exact: true }).focus();
  const stopped = await position();
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyD");
  const afterBlur = await position();
  assert.ok(Math.abs(afterBlur.x - stopped.x) < 0.15, "Blur clears held keys and brakes");
  await slider("Speed", 12);
  await slider("Camera follow", 1);
  await page.getByText("Settings JSON", { exact: true }).click();
  const json = JSON.parse(await page.getByRole("textbox", { name: "Settings JSON" }).inputValue());
  assert.equal(json.movement.speed, 12);
  assert.equal(json.cameraFollow, 1);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy settings" }).click();
  assert.equal(JSON.parse(await page.evaluate(() => navigator.clipboard.readText())).movement.speed, 12);
  const worldBox = await surface.boundingBox();
  const panelBox = await page.getByRole("complementary").boundingBox();
  assert.ok(worldBox.x + worldBox.width <= panelBox.x, "Scrolling controls never overlaps the world");
  await slider("Camera zoom", 0.5);
  await page.screenshot({ path: "docs/lab/screenshots/r1-player-zoom-min.png", fullPage: true });
  await slider("Camera zoom", 8);
  await page.screenshot({ path: "docs/lab/screenshots/r1-player-zoom-max.png", fullPage: true });
  await slider("Camera zoom", 2.2);
  await page.getByRole("button", { name: "Play time-lapse" }).click();
  const beforeTime = Number(await page.getByRole("slider", { name: "Time of day", exact: true }).inputValue());
  await page.waitForTimeout(700);
  const afterTime = Number(await page.getByRole("slider", { name: "Time of day", exact: true }).inputValue());
  assert.notEqual(beforeTime, afterTime, "Time-lapse still advances with the movement loop");
  await page.getByRole("button", { name: "Pause time-lapse" }).click();
  // Animation must change actual pixels without further interaction.
  const canvas = surface.locator("canvas");
  const first = await canvas.screenshot();
  await page.waitForTimeout(300);
  assert.notDeepEqual(await canvas.screenshot(), first, "Firelight still animates while idle");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Reset player", exact: true }).click();
  await slider("Speed", 4);
  await page.getByRole("complementary").evaluate((node) => { node.scrollTop = 0; });
  await surface.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const mobile = await surface.boundingBox();
  const mobilePanel = await page.getByRole("complementary").boundingBox();
  assert.ok(mobile.width > 100 && mobile.x + mobile.width <= mobilePanel.x);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Mobile layout has no horizontal overflow");
  await page.screenshot({ path: "docs/lab/screenshots/r1-player-mobile.png", fullPage: true });
  assert.deepEqual(errors, [], "No browser, shader or WebGL errors");
  console.log("R1 browser checks passed: stairs both ways, focus, JSON/clipboard, scroll, zoom extremes, time-lapse, idle firelight, mobile.");
} finally { await browser.close(); }
