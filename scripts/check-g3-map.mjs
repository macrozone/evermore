import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

// Start apps/www locally first. --live explicitly makes four bounded Vertex calls.
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:8400");
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));
const artifacts = path.resolve("docs/lab/experiments/g3-map/comparison");
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true });
const measurements = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(new URL("/lab/g3-map", origin).href);
  const metrics = page.getByTestId("map-metrics");
  await metrics.waitFor();
  const result = page.locator('canvas[aria-label="Layered map result"]');
  const snapshot = () => result.evaluate(canvas => canvas.toDataURL());
  const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const capture = name => page.screenshot({ path: path.join(artifacts, name + ".png"), fullPage: name !== "mobile-scrolled" });
  async function download(name, file) {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name, exact: true }).click();
    const item = await pending;
    await item.saveAs(path.join(artifacts, file));
    return file.endsWith(".json") ? JSON.parse(await readFile(path.join(artifacts, file), "utf8")) : null;
  }
  async function record(name) {
    await frame();
    const data = await download("Export layers + provenance", name + ".json");
    await download("Export sparse world (.evw)", name + ".evw");
    const count = data.dimensions.columns * data.dimensions.rows;
    assert.equal(data.materials.length, count);
    assert.equal(data.heightsRaster.length, count);
    for (const layer of Object.values(data.layers)) assert.equal(layer.length, count);
    measurements.push({ source: name, settings: data.settings, dimensions: data.dimensions, metrics: await metrics.textContent() });
    await page.getByRole("slider", { name: "Grid size", exact: true }).scrollIntoViewIfNeeded();
    await capture(name);
  }
  async function setSlider(name, value) {
    await page.getByRole("slider", { name, exact: true }).fill(String(value));
    await frame();
  }
  async function layout() {
    const control = await page.getByRole("complementary", { name: "Map controls" }).boundingBox();
    const canvas = await result.boundingBox();
    assert.ok(control && canvas && canvas.x + canvas.width <= control.x + 1, "Controls and result do not overlap");
    const visible = await result.evaluate(canvas => {
      const rect = canvas.parentElement.parentElement.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < innerHeight && rect.width > 80 && rect.height > 80;
    });
    assert.ok(visible, "The result viewport remains visible");
    assert.ok(control.y < page.viewportSize().height && control.y + control.height > 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal page overflow");
  }
  for (const source of ["cabin", "harbour"]) {
    await page.getByLabel("Source", { exact: true }).selectOption(source);
    await page.waitForFunction(source => document.querySelector('img[alt="Source map for colour analysis"]')?.src.includes(source === "cabin" ? "waldhuette" : "hafenstadt"), source);
    await record(source);
  }
  await page.getByLabel("Grid overlay", { exact: true }).uncheck();
  await frame();
  const baseline = await snapshot();
  await setSlider("Grid size", 8);
  assert.notEqual(await snapshot(), baseline);
  assert.match(await metrics.textContent(), /172 × 96/);
  await capture("harbour-grid-8");
  await setSlider("Grid size", 128);
  assert.match(await metrics.textContent(), /11 × 6/);
  await setSlider("Uncertainty threshold", 0);
  assert.match(await metrics.textContent(), /100\.0%/);
  await capture("harbour-strict");
  await setSlider("Uncertainty threshold", .6);
  assert.ok(!/100\.0%/.test(await metrics.textContent()));
  await page.getByLabel("Result view", { exact: true }).selectOption("height");
  await setSlider("Height scale", 0);
  const zero = await snapshot();
  await setSlider("Height scale", 12);
  assert.notEqual(await snapshot(), zero);
  for (const value of [.5, 3]) {
    await setSlider("Zoom", value);
    assert.equal(await result.evaluate(canvas => canvas.parentElement.style.width), value * 100 + "%");
  }
  await setSlider("Grid size", 32);
  await setSlider("Uncertainty threshold", .22);
  await setSlider("Height scale", 6);
  await setSlider("Zoom", 1);
  await page.getByLabel("Result view", { exact: true }).selectOption("materials");
  await page.evaluate(() => scrollTo(0, 250));
  await frame();
  await layout();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 250));
  await frame();
  await layout();
  await capture("mobile-scrolled");
  await setSlider("Zoom", 3);
  // Zoom scrolls within the viewport and does not widen the page.
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await setSlider("Zoom", 1);
  await page.setViewportSize({ width: 1440, height: 1000 });

  if (process.argv.includes("--live")) {
    const calls = [
      ["live-cabin-lite", "A forest clearing with a small cabin, a winding dirt path, a pond and tall trees.", "gemini-3.1-flash-lite-image"],
      ["live-harbour-lite", "A small harbour town with red-roofed houses, cobbled paths, timber docks and blue water.", "gemini-3.1-flash-lite-image"],
      ["live-harbour-flash", "A small harbour town with red-roofed houses, cobbled paths, timber docks and blue water.", "gemini-3.1-flash-image"],
      ["live-harbour-pro", "A small harbour town with red-roofed houses, cobbled paths, timber docks and blue water.", "gemini-3-pro-image"],
    ];
    for (const [name, prompt, model] of calls) {
      await page.getByLabel("Map description", { exact: true }).fill(prompt);
      await page.getByLabel("Image model", { exact: true }).selectOption(model);
      const responseWait = page.waitForResponse(response => response.url().endsWith("/api/lab/g3-map") && response.request().method() === "POST", { timeout: 120000 });
      await page.getByRole("button", { name: "Generate map", exact: true }).click();
      const response = await responseWait, generation = await response.json();
      const { image, ...metadata } = generation.map ?? {};
      await writeFile(path.join(artifacts, name + "-generation.json"), JSON.stringify({ ...generation, map: metadata }, null, 2));
      if (!response.ok()) {
        measurements.push({ source: name, failure: generation });
        await capture(name + "-error");
        console.log(name, response.status(), generation.error);
        continue;
      }
      await writeFile(path.join(artifacts, name + "-source.png"), Buffer.from(image.split(",")[1], "base64"));
      await page.waitForFunction(() => document.querySelector('img[alt="Source map for colour analysis"]')?.src.startsWith("data:"));
      await record(name);
      console.log(name, metadata.durationMs, metadata.estimatedCostUsd, metadata.costBasis);
    }
    // Exact settings are served from cache even with nearly exhausted reservations.
    const responseWait = page.waitForResponse(response => response.url().endsWith("/api/lab/g3-map") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Generate map", exact: true }).click();
    const response = await responseWait, repeated = await response.json();
    if (response.ok()) assert.equal(repeated.requestCostUsd, 0);
    await page.getByRole("slider", { name: "Grid size", exact: true }).scrollIntoViewIfNeeded();
    await capture("live-final");
  }
  // A sanitized API failure must be visible without replacing the current source.
  await page.route("**/api/lab/g3-map", async route => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "Vertex returned HTTP 404. Check model access; no fallback was used." }) });
  });
  await page.getByRole("button", { name: "Generate map", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "HTTP 404" }).waitFor();
  assert.ok(await result.isVisible());
  await capture("simulated-provider-error");
  assert.deepEqual(errors, []);
  if (!process.argv.includes("--live")) {
    try {
      const previous = JSON.parse(await readFile(path.join(artifacts, "measurements.json"), "utf8"));
      measurements.push(...previous.filter(item => item.source.startsWith("live-")));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  await writeFile(path.join(artifacts, "measurements.json"), JSON.stringify(measurements, null, 2));
  console.log("G3 headless checks passed: " + artifacts);
} finally {
  await browser.close();
}
