import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

// Start apps/www first: node scripts/check-r2-generation.mjs <local-origin> [artifacts]
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:3000");
assert.ok(["127.0.0.1", "localhost"].includes(origin.hostname), "Use a local lab server");
const artifacts = path.resolve(process.argv[3] ?? "docs/lab/screenshots/r2-generation");
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const capture = name => page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: true });
  await page.goto(new URL("/lab/g1-generator", origin).href);
  const json = page.getByRole("textbox", { name: "World specification JSON" });
  await json.waitFor();
  const specification = JSON.parse(await json.inputValue());
  await capture("source-g1");
  await writeFile(path.join(artifacts, "source.json"), JSON.stringify({ specification, seed: "evermore-g1" }, null, 2) + "\n");
  await page.goto(new URL("/lab/r2-tilemap", origin).href);
  await page.getByRole("combobox", { name: "Scene", exact: true }).selectOption("generator");
  const surface = page.getByRole("application", { name: "Tilemap world. Use WASD or arrow keys to move.", exact: true });
  const waitWorld = name => page.waitForFunction(expected => document.querySelector('[role="application"]')?.dataset.worldName === expected, name);
  const state = () => surface.evaluate(element => ({ ...element.dataset }));
  await waitWorld(specification.name);
  await capture("result-forest");
  const options = await page.getByRole("combobox", { name: "World specification" }).locator("option").allTextContents();
  assert.equal(options.length, 4);
  const movements = [];
  for (let index = 0; index < options.length; index++) {
    const previous = await state();
    await page.getByRole("combobox", { name: "World specification" }).selectOption(String(index));
    await page.getByRole("textbox", { name: "World seed", exact: true }).fill(`r2-example-${index}`);
    assert.equal((await state()).worldSeed, previous.worldSeed, "Draft edits do not regenerate");
    await page.getByRole("button", { name: "Generate world", exact: true }).click();
    await waitWorld(options[index]);
    await page.getByText(`${options[index]} · seed r2-example-${index}`, { exact: false }).waitFor();
    const start = await state();
    let distance = 0;
    for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
      await surface.focus();
      await page.keyboard.down(key);
      await page.waitForTimeout(350);
      await page.keyboard.up(key);
      const moved = await state();
      distance = Math.max(distance, Math.hypot(Number(moved.playerX) - Number(start.playerX), Number(moved.playerY) - Number(start.playerY)));
    }
    assert.ok(distance > 0.25, `${options[index]} permits keyboard movement`);
    movements.push({ name: options[index], distance, start });
    if (index === 1) await capture("result-harbour");
  }
  const beforeReroll = await state();
  await page.getByRole("button", { name: "New seed + generate", exact: true }).click();
  await page.waitForFunction(previous => document.querySelector('[role="application"]')?.dataset.worldSeed !== previous, beforeReroll.worldSeed);
  const seed = await page.getByRole("textbox", { name: "World seed", exact: true }).inputValue();
  assert.ok(/^\d+$/.test(seed));
  // Exercise the book's shared payload shape, storage fallback, and hash precedence.
  const saved = { specification: { ...specification, name: "Saved book world" }, seed: 777 };
  await page.evaluate(value => localStorage.setItem("evermore:lastSpec", JSON.stringify(value)), saved);
  await page.reload();
  await waitWorld(saved.specification.name);
  assert.equal(await page.getByRole("textbox", { name: "World seed", exact: true }).inputValue(), "777");
  const linked = { specification: { ...specification, name: "Linked book world" }, seed: "book-link" };
  const hash = await page.evaluate(async value => {
    const stream = new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream("deflate"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    return "#spec=" + btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  }, linked);
  await page.goto(new URL(`/lab/r2-tilemap${hash}`, origin).href);
  await waitWorld(linked.specification.name);
  assert.equal(await page.getByRole("textbox", { name: "World seed", exact: true }).inputValue(), linked.seed);
  await capture("result-book-import");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Generate world", exact: true }).scrollIntoViewIfNeeded();
  await capture("mobile");
  assert.ok(await page.getByRole("combobox", { name: "World specification" }).isVisible());
  await page.getByRole("button", { name: "Generate world", exact: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Mobile page does not overflow horizontally");
  await page.goto(new URL("/lab/r2-tilemap#spec=invalid", origin).href);
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByRole("combobox", { name: "Scene", exact: true }).inputValue(), "moodboard", "Invalid hash does not load saved world");
  assert.deepEqual(errors, []);
  const report = { examples: movements, rerolledSeed: seed, storageImport: true, hashPrecedence: true, invalidHash: true, mobile: true, errors };
  await writeFile(path.join(artifacts, "check.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
