import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

// Run against this worktree's dev server: node scripts/check-lab-overlays.mjs http://127.0.0.1:<BASE_PORT>
const origin = process.argv[2];
if (!origin || !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
  throw new Error("Provide the local worktree server origin as the only argument.");
}
const browser = await chromium.launch({ headless: true });
const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
// Inspect the full viewport capture: an isolated element capture can hide compositor paint bugs.
const headerPixels = (page, screenshot, bounds) => page.evaluate(async ({ data, bounds }) => {
  const image = new Image();
  image.src = `data:image/png;base64,${data}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(bounds.width) - 32;
  canvas.height = Math.floor(bounds.height) - 16;
  canvas.getContext("2d").drawImage(image, -Math.floor(bounds.x + 16), -Math.floor(bounds.y + 8));
  return canvas.toDataURL();
}, { data: screenshot.toString("base64"), bounds });
await mkdir("docs/lab/screenshots", { recursive: true });
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const size = viewport.width < 768 ? "mobile" : "desktop";
    for (const route of (process.env.LAB_OVERLAY_ROUTES?.split(",") ?? ["r1-voxel", "r2-tilemap", "g1-generator", "controls"])) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`${origin}/lab/${route}`, { waitUntil: "networkidle" });
      await page.addStyleTag({ content: "nextjs-portal { display: none; }" });
      const canvas = page.locator("[data-lab-scene] canvas");
      await canvas.waitFor();
      if (route !== "g1-generator") {
        await page.waitForFunction(() => /FPS: [1-9]/.test(document.querySelector('[aria-label="Renderer performance"]')?.textContent ?? ""));
      }
      const scene = await page.locator("[data-lab-scene]").boundingBox();
      assert.deepEqual(scene, { x: 0, y: 0, ...viewport });
      const panel = page.getByRole("region", { name: "Experiment controls" });
      const bounds = await panel.boundingBox();
      const toggle = panel.getByRole("button", { name: /Controls/ });
      const toggleBounds = await toggle.boundingBox();
      if (size === "desktop") assert(bounds.width <= viewport.width * .3 + 1);
      else assert(bounds.height <= viewport.height * .3 + 1);
      const title = await page.locator("main header").boundingBox();
      const hud = page.getByLabel("Renderer performance");
      if (await hud.count()) {
        assert(!overlaps(title, await hud.boundingBox()), `${route}: title overlaps performance`);
        assert(!overlaps(bounds, await hud.boundingBox()), `${route}: panel overlaps performance`);
      }
      const diagnostics = page.locator('[aria-label="Experiment diagnostics"], [aria-label="Cottage diagnostics"]');
      if (await diagnostics.count()) {
        assert(!overlaps(title, await diagnostics.boundingBox()), `${route}: title overlaps diagnostics`);
        assert(!overlaps(bounds, await diagnostics.boundingBox()), `${route}: panel overlaps diagnostics`);
      }
      const initialShot = await page.screenshot({ path: `docs/lab/screenshots/overlay-${route}-${size}.png` });
      const initialHeader = await headerPixels(page, initialShot, toggleBounds);
      const original = await canvas.elementHandle();
      await toggle.click();
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      assert(await original.evaluate(el => el.isConnected), `${route}: collapse unmounted canvas`);
      await toggle.click();
      const group = panel.locator("details").filter({ has: page.locator("fieldset") }).first();
      const summary = group.locator(":scope > summary");
      await summary.click();
      assert.equal(await group.getAttribute("open"), null);
      await summary.click();
      const content = panel.locator("[id]").first();
      await content.evaluate(el => { el.scrollTop = el.scrollHeight; });
      assert.deepEqual(await page.locator("[data-lab-scene]").boundingBox(), scene);
      assert.equal(await page.evaluate(() => window.scrollY), 0);
      assert.deepEqual(await toggle.boundingBox(), toggleBounds, `${route}: panel header moved during scrolling`);
      assert(await toggle.evaluate(el => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }), `${route}: panel header is covered`);
      assert.equal(await content.evaluate(el => el.scrollWidth > el.clientWidth + 1), false, `${route}: horizontal control overflow`);
      const scrolledShot = await page.screenshot({ path: `docs/lab/screenshots/overlay-${route}-${size}-scrolled.png` });
      assert.equal(await headerPixels(page, scrolledShot, toggleBounds), initialHeader, `${route}: scrolling changed the visible panel header`);
      const slider = route === "r1-voxel" ? page.getByRole("slider", { name: "Camera zoom", exact: true }) : panel.getByRole("slider").first();
      await slider.scrollIntoViewIfNeeded();
      await slider.focus();
      await page.keyboard.press("Home");
      const minimum = await slider.inputValue();
      const minImage = await canvas.screenshot();
      await page.keyboard.press("End");
      const maximum = await slider.inputValue();
      assert.notEqual(minimum, maximum, `${route}: slider failed`);
      await page.waitForTimeout(300);
      if (route === "r1-voxel" || route === "g1-generator") {
        assert(!minImage.equals(await canvas.screenshot()), `${route}: extremes did not change scene`);
      }
      const currentCanvas = await canvas.elementHandle();
      await toggle.click();
      await page.waitForTimeout(600);
      assert(await currentCanvas.evaluate(el => el.isConnected));
      await toggle.click();
      assert.equal(await slider.inputValue(), maximum, `${route}: collapse reset setting`);
      await slider.focus();
      await page.keyboard.press("Home");
      if (route !== "g1-generator") {
        const focusTarget = page.locator('[data-lab-scene] [tabindex="0"]');
        await focusTarget.focus();
        const before = await canvas.screenshot();
        await page.keyboard.down("KeyD");
        await page.waitForTimeout(900);
        await page.keyboard.up("KeyD");
        assert(!before.equals(await canvas.screenshot()), `${route}: movement did not change scene`);
      }
      if (route === "r1-voxel") {
        await page.getByRole("button", { name: "Play time-lapse", exact: true }).click();
        await toggle.click();
        const before = await canvas.screenshot();
        await page.waitForTimeout(1200);
        assert(!before.equals(await canvas.screenshot()), "r1-voxel: time-lapse did not animate with controls hidden");
        await toggle.click();
        await page.getByRole("button", { name: "Pause time-lapse", exact: true }).click();
      }
      assert.deepEqual(errors, [], `${route}: browser errors`);
      assert.equal(await page.locator("main [role=alert]").count(), 0, `${route}: rendering alert`);
      console.log(`PASS ${route} ${size}: bounds, HUD, scroll, groups, toggle, controls, movement`);
      await page.close();
    }
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${origin}/lab/image-to-voxel`, { waitUntil: "networkidle" });
  const stats = page.getByLabel("Renderer performance");
  await stats.waitFor();
  await page.waitForTimeout(1200);
  assert.match(await stats.textContent(), /FPS: 0/);
  assert.match(await stats.textContent(), /Triangles: [1-9]/);
  await page.getByRole("slider", { name: "Diagnostic turn" }).focus();
  await page.keyboard.press("End");
  await page.waitForTimeout(600);
  assert.match(await stats.textContent(), /Frame time \(CPU\)/);
  await page.screenshot({ path: "docs/lab/screenshots/overlay-image-to-voxel-desktop.png", fullPage: true });
  console.log("PASS image-to-voxel: shared on-demand performance and introduction");
} finally {
  await browser.close();
}
