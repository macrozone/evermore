import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

// Start apps/www, then run this headless check against its local URL.
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:3000");
assert.ok(["127.0.0.1", "localhost"].includes(origin.hostname));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("404")) errors.push(message.text());
  });
  const surface = page.getByRole("application", { name: "Voxel world movement" });
  const active = page.locator('[aria-label="Active generation"]');
  const source = page.getByRole("combobox", { name: "Source world" });
  const seed = page.getByRole("textbox", { name: "Generation seed" });
  const generate = page.getByRole("button", { name: "Generate", exact: true });
  const position = () => surface.evaluate(node => [node.dataset.playerX, node.dataset.playerY, node.dataset.playerZ]);
  const regenerate = async () => {
    const previous = await surface.locator("canvas").elementHandle();
    await generate.click();
    await page.waitForFunction(canvas => !canvas.isConnected, previous);
    await surface.locator("canvas").waitFor();
    await page.waitForTimeout(400);
    assert.equal(await surface.locator("canvas").count(), 1, "Only one renderer survives regeneration");
  };
  await page.goto(new URL("/lab/r1-voxel", origin).href);
  await page.waitForFunction(() => document.querySelector('[role="application"]')?.dataset.playerX);
  assert.equal(await seed.isDisabled(), true);
  assert.match(await active.innerText(), /meadow-house.*20261002/);
  await source.selectOption("0");
  await seed.fill("r1-reproducible");
  assert.match(await active.innerText(), /meadow-house/, "Draft changes must leave the world alone");
  await page.getByText("Source specification JSON", { exact: true }).click();
  const input = JSON.parse(await page.getByRole("textbox", { name: "Source specification JSON" }).inputValue());
  await regenerate();
  assert.ok((await active.innerText()).includes(input.specification.name));
  assert.match(await active.innerText(), /r1-reproducible.*\d+\.\d ms generation/);
  const spawn = await position();
  const first = await surface.locator("canvas").screenshot();
  await surface.focus();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(500);
  await page.keyboard.up("ArrowRight");
  assert.notDeepEqual(await position(), spawn, "Generated worlds support player movement");
  await regenerate();
  assert.deepEqual(await position(), spawn, "Generate with unchanged inputs still returns to spawn");
  assert.deepEqual(await surface.locator("canvas").screenshot(), first, "Same source and seed reproduce the framebuffer");
  await page.getByRole("button", { name: "Roll seed" }).click();
  assert.notEqual(await seed.inputValue(), "r1-reproducible");
  assert.match(await active.innerText(), /r1-reproducible/, "Rolling the seed is also a draft change");
  await regenerate();
  assert.notDeepEqual(await surface.locator("canvas").screenshot(), first, "A different seed produces different terrain");

  await page.evaluate(input => localStorage.setItem("evermore:lastSpec", JSON.stringify({ ...input, seed: "saved-book" })), input);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[aria-label="Active generation"]')?.textContent.includes("saved-book"));
  assert.equal(await source.inputValue(), "-2");
  const hash = await page.evaluate(async input => {
    const stream = new Blob([JSON.stringify({ ...input, seed: "linked-book" })]).stream().pipeThrough(new CompressionStream("deflate"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    return "#spec=" + btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  }, input);
  await page.goto(new URL("/lab/r1-voxel" + hash, origin).href);
  await page.waitForFunction(() => document.querySelector('[aria-label="Active generation"]')?.textContent.includes("linked-book"));
  assert.equal(await seed.inputValue(), "linked-book", "Hash takes precedence over saved specification");
  await seed.fill("r1-review");
  await page.getByText("Source specification JSON", { exact: true }).click();
  await regenerate();
  await page.getByRole("button", { name: "Wide view", exact: true }).click();
  await page.waitForTimeout(400);
  await mkdir("docs/lab/screenshots/r1-generation", { recursive: true });
  await page.locator('aside[aria-label="Voxel experiment settings"]').evaluate(node => { node.scrollTop = 0; });
  await page.screenshot({ path: "docs/lab/screenshots/r1-generation/source.png", fullPage: true });
  await page.getByText("Source specification JSON", { exact: true }).click();
  await page.screenshot({ path: "docs/lab/screenshots/r1-generation/result.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('aside[aria-label="Voxel experiment settings"]').evaluate(node => { node.scrollTop = 0; });
  const canvasBox = await surface.boundingBox();
  const panelBox = await page.locator('aside[aria-label="Voxel experiment settings"]').boundingBox();
  assert.ok(canvasBox.x + canvasBox.width <= panelBox.x, "Canvas and panel remain side by side");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No mobile overflow");
  await page.screenshot({ path: "docs/lab/screenshots/r1-generation/mobile.png", fullPage: true });
  await source.selectOption("-1");
  await regenerate();
  assert.match(await active.innerText(), /meadow-house.*20261002/);
  assert.deepEqual(await position(), ["12.500", "45.500", "3"]);
  await page.goto(new URL("/lab/r1-voxel#spec=invalid", origin).href);
  await page.getByRole("alert").waitFor();
  assert.match(await active.innerText(), /meadow-house/, "A corrupt link must not silently load saved data");
  assert.deepEqual(errors, []);
  console.log("R1 generation: draft/apply, seeded framebuffer, movement/reset, hash/storage, fixture, mobile and error checks passed.");
} finally {
  await browser.close();
}
