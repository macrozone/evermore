/** Headless proof of the local A/C comparison; never calls a paid model. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { chromium } from "playwright";

const origin = process.env.LAB_ORIGIN ?? `http://127.0.0.1:${parseEnv(await readFile(new URL("../.env.local", import.meta.url), "utf8")).BASE_PORT}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const canvas = page.getByLabel(/south character/);
const pixels = () => canvas.evaluate(element => Array.from(element.getContext("2d").getImageData(0, 0, element.width, element.height).data));
const range = async (label, value) => {
  await page.getByLabel(label, { exact: true }).evaluate((input, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await page.waitForTimeout(150);
};
const workspace = async () => {
  await page.getByLabel("Character workspace", { exact: true }).evaluate(element => element.scrollIntoView({ block: "start" }));
  const bounds = await page.getByLabel("Character workspace", { exact: true }).evaluate(element => {
    const rect = element.children[0].getBoundingClientRect();
    const controls = element.children[1].getBoundingClientRect();
    const canvases = [...element.querySelectorAll("figure canvas")].filter(canvas => canvas.getBoundingClientRect().height > 0).slice(0, 4);
    return { controls: controls.toJSON(), preview: rect.toJSON(), canvases: canvases.map(canvas => canvas.getBoundingClientRect().toJSON()), overflow: document.documentElement.scrollWidth > innerWidth };
  });
  const viewport = page.viewportSize();
  assert.equal(bounds.overflow, false);
  assert.equal(bounds.canvases.length, 4);
  for (const rect of [bounds.controls, ...bounds.canvases]) {
    assert.ok(rect.x >= 0 && rect.y >= 0 && rect.right <= viewport.width && rect.bottom <= viewport.height, JSON.stringify(rect));
  }
  for (const rect of bounds.canvases) assert.ok(rect.right <= bounds.controls.x || rect.bottom <= bounds.controls.y, "Controls overlap sprites");
};
try {
  await page.goto(`${origin}/lab/character`, { waitUntil: "networkidle" });
  await page.getByLabel("Rendering", { exact: true }).selectOption("voxel");
  await page.getByLabel("Render performance").filter({ hasText: "FPS" }).waitFor();
  await workspace();
  const initial = await pixels();
  let moves = false;
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(90);
    if (JSON.stringify(await pixels()) !== JSON.stringify(initial)) { moves = true; break; }
  }
  assert.ok(moves, "Walk animation must change pixels without interaction");
  await page.screenshot({ path: new URL("../docs/lab/screenshots/character-voxel.png", import.meta.url).pathname, fullPage: true });
  await page.getByLabel("Play walk cycle").uncheck();
  await range("Frame", 1);
  const paused = await pixels();
  await page.waitForTimeout(450);
  assert.deepEqual(await pixels(), paused);
  await range("Frame", 3); assert.notDeepEqual(await pixels(), paused);
  await range("Frame", 1);
  for (const [label, value] of [["Camera elevation", 70], ["Light direction", 135], ["Ambient light", 1], ["Sunlight", 0]]) {
    const before = await pixels(); await range(label, value); assert.notDeepEqual(await pixels(), before, label);
    await workspace();
  }
  await page.getByRole("button", { name: "Reset camera & light" }).click();
  await range("Camera elevation", 20);
  await range("Size", 6);
  await page.getByLabel("Pixel density", { exact: true }).selectOption("32");
  await workspace();
  await page.screenshot({ path: new URL("../docs/lab/screenshots/character-voxel-camera.png", import.meta.url).pathname, fullPage: true });
  for (const density of [16, 24, 32]) {
    await page.getByLabel("Pixel density", { exact: true }).selectOption(String(density));
    for (const size of [2, 6]) { await range("Size", size); await workspace(); }
  }
  await page.getByLabel("Example character", { exact: true }).selectOption("1");
  await page.getByRole("combobox", { name: /^hair/ }).selectOption("bald");
  const hairless = await pixels();
  await page.getByRole("combobox", { name: /^hair/ }).selectOption("long");
  assert.notDeepEqual(await pixels(), hairless);
  const beforeColour = await pixels();
  await page.getByLabel("clothing colour", { exact: true }).fill("#ffffff");
  await page.waitForTimeout(150); assert.notDeepEqual(await pixels(), beforeColour);
  await page.getByText("Character & settings JSON", { exact: true }).click();
  const json = JSON.parse(await page.getByLabel("Character and settings JSON", { exact: true }).inputValue());
  assert.equal(json.experiment, "character-voxel"); assert.equal(json.settings.voxel.elevation, 20); assert.equal(json.specification.colors.clothing, "#ffffff");
  await page.getByRole("button", { name: "Copy JSON" }).click();
  await page.getByRole("status").filter({ hasText: /Copied character|Select and copy/ }).waitFor();
  const voxelPixels = await pixels();
  await page.getByLabel("Rendering", { exact: true }).selectOption("paper-doll");
  await page.waitForTimeout(150); assert.notDeepEqual(await pixels(), voxelPixels);
  assert.equal(await page.getByLabel("Camera elevation", { exact: true }).count(), 0);
  await page.getByLabel("Rendering", { exact: true }).selectOption("voxel");
  await page.setViewportSize({ width: 900, height: 700 }); await workspace();
  await page.setViewportSize({ width: 390, height: 844 }); await workspace();
  await page.screenshot({ path: new URL("../docs/lab/screenshots/character-voxel-mobile.png", import.meta.url).pathname, fullPage: true });
  for (const elevation of [20, 70]) { await range("Camera elevation", elevation); await workspace(); }
  await page.getByLabel("Example character", { exact: true }).selectOption("0");
  await page.getByLabel("Pixel density", { exact: true }).selectOption("24");
  await range("Size", 4);
  await page.getByRole("button", { name: "Reset camera & light" }).click();
  await workspace();
  await page.screenshot({ path: new URL("../docs/lab/screenshots/character-voxel-mobile.png", import.meta.url).pathname, fullPage: true });
  assert.deepEqual(errors, []);
  console.log("Voxel character: time, pause/frame, light/camera, parts/colour, all densities/scales, JSON, A/C switch, scroll/mobile bounds passed.");
} finally { await browser.close(); }
