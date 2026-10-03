import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

// Run after pnpm build. Replay measured fixtures without making paid model calls.
const listener = createServer();
await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve));
const port = listener.address().port;
await new Promise(resolve => listener.close(resolve));
const server = spawn("pnpm", ["exec", "next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: new URL("../apps/www/", import.meta.url), detached: true, stdio: "ignore",
  env: { ...process.env, BOOK_VERTEX_DISABLED: "true" },
});
let browser;
try {
  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1000) });
      await response.body?.cancel(); ready = response.ok;
    } catch { /* Allow the production server to start. */ }
    if (ready) break;
    assert.equal(server.exitCode, null, "production server exited");
    await delay(100);
  }
  assert.ok(ready, "production server did not start");
  const fixtures = await Promise.all(["g1-flash-lite", "g2-flash-lite"].map(async name =>
    JSON.parse(await readFile(new URL(`../docs/lab/experiments/book-${name}.json`, import.meta.url), "utf8"))));
  browser = await chromium.launch({ headless: true });
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.route("**/api/lab/book", route => {
      const input = route.request().postDataJSON();
      const fixture = fixtures[input.strategy === "g2" ? 1 : 0];
      return route.fulfill({ json: fixture.generation });
    });
    await page.goto(`${origin}/lab/book?strategy=g2`);
    await page.getByLabel("Generation approach").waitFor();
    assert.equal(await page.getByLabel("Generation approach").inputValue(), "g2");
    assert.equal(await page.getByLabel("Generation model").inputValue(), "gemini-3.8-flash");
    assert.ok(await page.getByRole("button", { name: "Turn the page →", exact: true }).isDisabled());
    await page.getByRole("textbox", { name: "Who are you and where are you?" }).fill(fixtures[1].answers[0]);
    await page.getByRole("button", { name: "Turn the page →", exact: true }).click();
    await page.getByRole("textbox", { name: "Where do you sleep?" }).fill(fixtures[1].answers[1]);
    await page.getByRole("button", { name: "Read your beginning →" }).click();
    await page.getByRole("button", { name: "Draw world layers" }).click();
    const canvas = page.getByRole("img");
    await canvas.waitFor();
    const pixels = () => canvas.evaluate(element => element.toDataURL());
    const original = await pixels();
    const layer = page.getByLabel("Height layer", { exact: false });
    for (const value of ["0", "3", "1"]) {
      await layer.fill(value);
      await layer.evaluate(element => element.scrollIntoView({ block: "center" }));
      const mapBox = await canvas.boundingBox(), controlBox = await layer.boundingBox();
      assert.ok(mapBox.y >= 0 && mapBox.y + mapBox.height <= 900, "map remains visible beside layer control");
      assert.ok(controlBox.y >= 0 && controlBox.y + controlBox.height <= 900, "layer control visible");
      assert.ok(mapBox.x + mapBox.width <= controlBox.x, "map and controls do not overlap");
      if (value === "3") assert.notEqual(await pixels(), original, "height changes rendered cells");
    }
    await page.getByLabel("Show lower layers through air").evaluate(element => element.scrollIntoView({ block: "center" }));
    assert.ok(await canvas.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
    }), "map stays visible while scrolling to toggles");
    await page.getByLabel("Show original model cells").check();
    await page.getByLabel("Show lower layers through air").uncheck();
    assert.notEqual(await pixels(), original, "composite toggle changes rendered cells");
    await page.getByLabel("Show lower layers through air").check();
    await page.getByLabel("Show original model cells").uncheck();
    await layer.evaluate(element => element.scrollIntoView({ block: "center" }));
    await page.screenshot({ path: new URL(`../docs/lab/screenshots/book-g2-${width === 390 ? "mobile" : "controls"}.png`, import.meta.url).pathname, fullPage: true });
    if (width === 390) assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no mobile overflow");
    await page.getByLabel("Generation approach").selectOption("g1");
    assert.equal(await canvas.count(), 0, "strategy change discards previous map");
    await page.getByRole("button", { name: "Generate world specification" }).click();
    await canvas.waitFor();
    assert.equal(await page.locator("tbody tr").count(), 2, "history compares both approaches");
    assert.deepEqual(errors, [], "no browser errors");
    await page.close();
    console.log(`Book G2 production browser checks passed at ${width}px`);
  }
} finally {
  await browser?.close();
  if (server.pid) { try { process.kill(-server.pid, "SIGTERM"); } catch (error) { if (error.code !== "ESRCH") throw error; } }
}
