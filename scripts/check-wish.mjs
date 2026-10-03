import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const origin = process.env.WISH_TEST_ORIGIN ?? "http://127.0.0.1:9100";
const output = "docs/lab/screenshots";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 375, height: 667 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${origin}/lab/wish`);
    await page.getByRole("heading", { name: "Before a wish comes true" }).waitFor();
    const controls = page.getByTestId("wish-controls");
    const result = page.getByTestId("wish-result");
    const simultaneous = async () => {
      const a = await controls.boundingBox(), b = await result.boundingBox();
      assert(a && b);
      for (const box of [a, b]) assert(box.y >= 0 && box.y + box.height <= viewport.height + 1);
      assert(a.x + a.width <= b.x + 1 || a.y + a.height <= b.y + 1);
      for (const name of ["Influence", "Inspiration"]) {
        // Sliders must remain visible even while the example list is scrolled.
        const slider = await page.getByLabel(name, { exact: true }).boundingBox();
        const cost = await page.getByTestId("inspiration-cost").boundingBox();
        assert(slider && cost && slider.y >= 0 && cost.y >= 0 && cost.y + cost.height <= viewport.height);
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    };
    await simultaneous();
    assert.equal(await page.getByTestId("inspiration-cost").textContent(), "6");
    await page.screenshot({ path: `${output}/wish-${viewport.width}-start.png` });
    await controls.locator("[class*=examples]").evaluate(element => { element.scrollTop = element.scrollHeight; });
    await page.getByRole("button", { name: "A castle on a mountain", exact: false }).click();
    assert.equal(await page.getByTestId("wish-verdict").textContent(), "Wish rejected");
    await simultaneous();
    await page.screenshot({ path: `${output}/wish-${viewport.width}-scroll.png` });
    await page.getByLabel("Your wish", { exact: true }).fill("A reading nook beside the window");
    assert.match(await result.textContent(), /generic offline placeholder/);
    await page.getByLabel("Place", { exact: true }).fill("My home");
    await page.getByLabel("Model", { exact: true }).selectOption("gemini-3.1-pro-preview");
    const slider = async (label, value) => {
      await page.getByLabel(label, { exact: true }).evaluate((element, next) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(element, next);
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }, String(value));
    };
    await slider("Influence", 0); await slider("Inspiration", 5000);
    assert.equal(await page.getByTestId("wish-verdict").textContent(), "Wish rejected");
    assert.match(await result.textContent(), /no influence/i);
    await slider("Influence", 1); await slider("Inspiration", 0);
    assert.equal(await page.getByTestId("wish-verdict").textContent(), "Wish rejected");
    await slider("Inspiration", 5000);
    assert.equal(await page.getByTestId("wish-verdict").textContent(), "Within budget");
    await page.getByRole("button", { name: "Repeat ×3" }).click();
    await page.getByRole("status").filter({ hasText: "3 calls completed" }).waitFor();
    assert.match(await page.getByTestId("consistency").textContent(), /Not measured/);
    const exported = JSON.parse(await page.getByLabel("Parameters and results JSON").inputValue());
    assert.equal(exported.runs.length, 3); assert.equal(exported.consistency, null);
    assert.equal(exported.input.model, "gemini-3.1-pro-preview");
    await result.getByRole("button", { name: "Use smaller wish" }).click();
    assert.equal(await page.getByLabel("Your wish", { exact: true }).inputValue(), "Add one small decorative stone beside my bed.");
    await simultaneous();
    await page.screenshot({ path: `${output}/wish-${viewport.width}-interaction.png` });
    assert.deepEqual(errors, []);
    await page.close();
  }
  // Exercise the actual client repeat flow with variable live responses, without
  // charging a provider. Live measurements are recorded separately below.
  const page = await browser.newPage();
  let calls = 0;
  await page.route("**/api/lab/wish", async route => {
    calls++;
    const request = route.request().postDataJSON();
    const result = { scope: { area: 1, cells: 2, structures: calls, complexity: 1, reason: "Headless mock scope", smallerWish: "One pebble" }, source: "vertex", model: request.model, durationMs: 10, usage: { inputTokens: 100, outputTokens: 50, thinkingTokens: 0 }, estimatedUsd: 0.00017, pricingBasis: "Headless mock" };
    await route.fulfill({ json: result });
  });
  await page.goto(`${origin}/lab/wish`);
  await page.getByLabel("Estimation mode").selectOption("live");
  await page.getByRole("button", { name: "Repeat ×3" }).click();
  await page.getByRole("status").filter({ hasText: "3 calls completed" }).waitFor();
  assert.equal(calls, 3);
  assert.match(await page.getByTestId("consistency").textContent(), /6–12 inspiration/);
  const data = JSON.parse(await page.getByLabel("Parameters and results JSON").inputValue());
  assert.equal(data.consistency.relativeSpread, 6 / 9);
  await page.getByLabel("Place", { exact: true }).fill("A new location");
  assert.match(await page.getByTestId("consistency").textContent(), /Not measured/);
  await writeFile(`${output}/wish-headless-check.json`, JSON.stringify({ passed: true, viewports: ["1440x1000", "390x844", "375x667"], checks: ["start", "independent scrolling", "example/free text", "model selection", "zero influence", "zero/max inspiration", "offline repeat exclusion", "live repeat flow (mock)", "stale-context reset", "JSON export", "smaller wish"], liveMock: true }, null, 2) + "\n");
  console.log("Wish headless checks passed at three viewport sizes.");
} finally { await browser.close(); }
