import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

// Run against a production server. BOOK_CHECK_LIVE=true requires a Vertex result.
const origin = process.env.BOOK_CHECK_ORIGIN ?? "http://127.0.0.1:4900";
const directory = "docs/lab/screenshots";
const artifact = process.env.BOOK_CHECK_ARTIFACT ?? "book-world";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${origin}/lab/book`, { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "Who are you and where are you?" }).fill("I am a botanist living in a quiet forest cottage beside a river.");
  await page.getByRole("button", { name: "Turn the page" }).click();
  await page.getByRole("textbox", { name: "Where do you sleep?" }).fill("In my bedroom above the kitchen on the second floor of my cottage, beneath a warm quilt.");
  await page.getByRole("button", { name: "Read your beginning" }).click();
  const started = performance.now();
  const responsePromise = page.waitForResponse(response => response.url().endsWith("/api/lab/book") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Generate world specification" }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 200);
  const result = await response.json();
  assert.ok(result.specification.sleepingPlace);
  if (process.env.BOOK_CHECK_LIVE === "true") assert.equal(result.source, "vertex", JSON.stringify(result));
  await page.getByRole("navigation", { name: "View generated world" }).waitFor();
  const bookMs = performance.now() - started;
  await page.getByRole("navigation", { name: "View generated world" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${directory}/${artifact}-desktop.png`, fullPage: true });
  const navigationStarted = performance.now();
  await page.getByRole("link", { name: "View in R1" }).click();
  await page.getByLabel("World start").waitFor();
  await page.waitForFunction(() => /Player:/.test(document.querySelector('[aria-label="Player position"]')?.textContent ?? "") && (document.querySelector('canvas')?.width ?? 0) > 0);
  const flowMs = bookMs + performance.now() - navigationStarted;
  assert.ok((await page.getByLabel("World start").innerText()).includes(result.specification.sleepingPlace.name));
  const position = page.getByLabel("Player position");
  const initial = await position.innerText();
  const sleep = result.specification.sleepingPlace;
  if (sleep.buildingIndex !== null) {
    const building = result.specification.settlement.buildings[sleep.buildingIndex];
    const base = Math.max(result.specification.terrain.elevation, result.specification.water.level + 1);
    assert.equal(initial, `Player: ${(building.x + building.width - 3.5).toFixed(2)}, ${(building.y + 3.5).toFixed(2)} · Floor ${base + sleep.floor * 4}`);
  }
  const surface = page.getByRole("application", { name: "Voxel world movement" });
  await surface.click();
  await page.keyboard.down("ArrowDown");
  await page.waitForTimeout(350);
  await page.keyboard.up("ArrowDown");
  await page.waitForTimeout(300);
  assert.notEqual(await position.innerText(), initial, "player must move away from bed");
  await page.getByRole("button", { name: "Reset player" }).click();
  await page.waitForTimeout(300);
  assert.equal(await position.innerText(), initial);
  const statsBefore = await page.getByLabel("World start").innerText();
  // Slider extremes, scroll, and idle keep the settings alongside the world.
  for (const value of ["0.5", "8", "2.2"]) {
    await page.getByLabel("Camera zoom").fill(value);
    await page.waitForTimeout(300);
    const [world, panel] = await Promise.all([surface.boundingBox(), page.getByRole("complementary", { name: "Voxel experiment settings" }).boundingBox()]);
    assert.ok(world && panel && world.x + world.width <= panel.x + 1);
  }
  await surface.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  assert.equal(await position.innerText(), initial, "idle must not move the player");
  await page.getByRole("complementary", { name: "Voxel experiment settings" }).evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: `${directory}/${artifact}-r1-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await surface.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "mobile horizontal overflow");
  const [world, panel] = await Promise.all([surface.boundingBox(), page.getByRole("complementary", { name: "Voxel experiment settings" }).boundingBox()]);
  assert.ok(world && panel && world.x + world.width <= panel.x + 1);
  await page.screenshot({ path: `${directory}/${artifact}-r1-mobile.png`, fullPage: true });
  assert.deepEqual(errors, []);
  const measurement = { source: result.source, model: result.model, providerMs: result.durationMs, flowMs: Math.round(flowMs), usage: result.usage, sleepingPlace: result.specification.sleepingPlace, start: statsBefore, initial, seed: result.seed, errors };
  await writeFile(`${directory}/${artifact}-measurement.json`, JSON.stringify(measurement, null, 2) + "\n");
  console.log(JSON.stringify(measurement, null, 2));
} finally {
  await browser.close();
}
