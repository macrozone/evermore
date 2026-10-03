import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

// Run against this worktree's running www server:
// node scripts/check-r2-movement.mjs http://127.0.0.1:<BASE_PORT>
const origin = process.argv[2];
assert(origin, "Pass the origin of this worktree's running www server");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(new URL("/lab/r2-tilemap", origin).href);
  const surface = page.getByRole("application");
  const canvas = surface.locator("canvas");
  await canvas.waitFor();
  const diagnostics = page.getByRole("definition").filter({ hasText: /^x / });
  const position = async () => {
    const text = await diagnostics.first().innerText();
    const values = text.match(/-?\d+\.\d+/g).map(Number);
    return { x: values[0], y: values[1], z: values[2] };
  };
  await page.waitForFunction(() => document.querySelector('[aria-label="Frame-time graph"] polyline')?.getAttribute("points")?.length > 50);
  const initial = await position();
  await canvas.evaluate((node) => { node.dataset.checkIdentity = "original"; });
  await surface.focus();
  // One keydown per direction, with no repeat events, must keep moving.
  await page.keyboard.down("KeyD");
  await page.keyboard.down("KeyS");
  await page.waitForTimeout(500);
  const earlyDiagonal = await position();
  assert(earlyDiagonal.x > initial.x + 0.3 && earlyDiagonal.y > initial.y + 0.3);
  const velocity = (await diagnostics.last().innerText()).match(/-?\d+\.\d+/g).map(Number);
  assert(Math.abs(velocity[0] - velocity[1]) < 0.05, "Diagonal velocity axes match");
  assert(Math.abs(Math.hypot(...velocity) - 4) < 0.05, "Diagonal speed stays normalized");
  const firstFrame = await canvas.screenshot();
  await page.waitForTimeout(500);
  const secondFrame = await canvas.screenshot();
  await page.keyboard.up("KeyD");
  await page.keyboard.up("KeyS");
  await page.waitForTimeout(400);
  const diagonal = await position();
  assert(diagonal.x > initial.x + 1 && diagonal.y > initial.y + 1, "Held diagonal keys move along both axes");

  assert(!firstFrame.equals(secondFrame), "The rendered world changes while moving");

  // Tuning and layer changes must preserve the renderer and position.
  for (const slider of await page.getByRole("slider").all()) {
    await slider.focus();
    for (const key of ["End", "Home"]) {
      await page.keyboard.press(key);
      await page.waitForTimeout(300);
      assert.deepEqual(await position(), diagonal, "Changing a slider must not reset the player");
      assert.equal(await canvas.getAttribute("data-check-identity"), "original", "Changing a slider must not recreate the canvas");
    }
  }
  const cutaway = page.getByRole("checkbox", { name: "Building cutaway" });
  await cutaway.uncheck();
  await cutaway.check();
  await page.waitForTimeout(300);
  assert.deepEqual(await position(), diagonal);
  assert.equal(await canvas.getAttribute("data-check-identity"), "original");
  const json = page.getByText("Settings JSON", { exact: true });
  await json.click();
  const settings = JSON.parse(await page.getByRole("textbox", { name: "Settings JSON" }).inputValue());
  assert.equal(settings.movement.speed, 1);
  await json.click();

  // Walk diagonally north/east into the house's south wall, then slide east.
  await page.getByRole("slider").nth(0).focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("slider").nth(1).focus();
  await page.keyboard.press("End");
  await page.getByRole("slider").nth(2).focus();
  await page.keyboard.press("End");
  await page.getByRole("button", { name: "Reset to door" }).click();
  await page.waitForTimeout(400);
  await surface.focus();
  await page.keyboard.down("KeyD");
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyD");
  await page.keyboard.up("KeyW");
  await page.waitForTimeout(400);
  const slide = await position();
  assert(slide.x > 13.5, "Diagonal input slides along the house wall");
  assert(slide.y >= 44.2 && slide.y < 45.5, "The player reaches but does not cross the wall");
  assert.equal(slide.z, 3, "Wall sliding must not climb onto the roof");

  await mkdir("/tmp/evermore-r2-check", { recursive: true });
  await page.screenshot({ path: "/tmp/evermore-r2-check/interaction.png", fullPage: true });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const panel = page.locator("details").first();
  const visible = async () => {
    const [world, controls, debug] = await Promise.all([surface.boundingBox(), panel.boundingBox(), page.locator('[aria-label="Experiment diagnostics"]').boundingBox()]);
    const viewport = page.viewportSize();
    assert(world.x >= 0 && world.x + world.width <= viewport.width + 1, "The world fits the viewport width");
    assert(controls.x >= 0 && controls.x + controls.width <= viewport.width + 1, "Controls fit the viewport width");
    if (viewport.width < 640) assert(controls.x > world.x + world.width / 2 + 10, "Mobile settings leave the centered player visible");
    assert(controls.y >= world.y && controls.y + controls.height <= world.y + world.height + 1, "Settings stay over the world");
    assert(controls.y >= 0 && controls.y < viewport.height, "Settings stay visible after scrolling");
    const overlap = controls.x < debug.x + debug.width && controls.x + controls.width > debug.x && controls.y < debug.y + debug.height && controls.y + controls.height > debug.y;
    assert(!overlap, "Diagnostics and settings do not overlap");
  };
  await visible();
  await page.screenshot({ path: "/tmp/evermore-r2-check/scroll.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await visible();
  await page.screenshot({ path: "/tmp/evermore-r2-check/mobile.png", fullPage: true });
  assert.deepEqual(errors, [], "No browser exceptions");
  console.log(JSON.stringify({ initial, diagonal, slide, browserErrors: errors, screenshots: "/tmp/evermore-r2-check" }, null, 2));
} finally {
  await browser.close();
}
