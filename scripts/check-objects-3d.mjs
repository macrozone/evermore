/** Headless offline import proof; synthetic mesh is deliberately not a SAM result. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { chromium } from "playwright";

const { BASE_PORT } = parseEnv(await readFile(new URL("../.env.local", import.meta.url), "utf8"));
const output = new URL("../docs/lab/objects-3d/proof/", import.meta.url);
await mkdir(output, { recursive: true });
// A colored asymmetric pyramid, encoded directly as a self-contained GLB.
const vertices = new Float32Array([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, -.4, 2, -.2]);
const indices = new Uint16Array([0, 2, 1, 0, 3, 2, 0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4]);
const binary = Buffer.concat([Buffer.from(vertices.buffer), Buffer.from(indices.buffer)]);
const json = { asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }], materials: [{ pbrMetallicRoughness: { baseColorFactor: [.7, .25, .12, 1], metallicFactor: 0 } }], buffers: [{ byteLength: binary.length }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: vertices.byteLength }, { buffer: 0, byteOffset: vertices.byteLength, byteLength: indices.byteLength }], accessors: [{ bufferView: 0, componentType: 5126, count: 5, type: "VEC3", min: [-1, 0, -1], max: [1, 2, 1] }, { bufferView: 1, componentType: 5123, count: 18, type: "SCALAR" }] };
const text = Buffer.from(JSON.stringify(json)); const padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32); text.copy(padded);
const header = Buffer.alloc(20); [0x46546c67, 2, 28 + padded.length + binary.length, padded.length, 0x4e4f534a].forEach((v, i) => header.writeUInt32LE(v, i * 4));
const chunk = Buffer.alloc(8); chunk.writeUInt32LE(binary.length, 0); chunk.writeUInt32LE(0x004e4942, 4);
const fixture = Buffer.concat([header, padded, chunk, binary]);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = []; const external = [];
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => { if (!request.url().startsWith("http://127.0.0.1:") && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) external.push(request.url()); });
const changeRange = async (label, value) => {
  await page.getByLabel(label, { exact: false }).evaluate((input, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await page.waitForTimeout(200);
};
const visibleWorkspace = async () => {
  await page.locator('[aria-label="Offline object comparison"]').evaluate(el => el.scrollIntoView({ block: "start" }));
  const [controls, views] = await page.locator('[aria-label="Offline object comparison"]').evaluate(el => [...el.children].map(child => { const r = child.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; }));
  const viewport = page.viewportSize();
  for (const rect of [controls, views]) { assert.ok(rect.x >= 0 && rect.y >= 0 && rect.right <= viewport.width && rect.bottom <= viewport.height, JSON.stringify(rect)); }
  assert.ok(controls.right <= views.x || controls.bottom <= views.y, "Controls overlap results");
};
try {
  await page.goto(`${process.env.LAB_ORIGIN ?? `http://127.0.0.1:${BASE_PORT}`}/lab/objects-3d`, { waitUntil: "networkidle" });
  await page.getByText("Awaiting a reconstruction export.", { exact: true }).waitFor();
  await page.screenshot({ path: new URL("start.png", output).pathname, fullPage: true });
  for (const id of ["house", "tree", "well", "lantern"]) {
    await page.getByLabel("Original object").selectOption(id);
    assert.ok((await page.locator("figure img").getAttribute("src")).endsWith(`${id}.png`));
  }
  await page.getByLabel("Original object").selectOption("house");
  await page.getByLabel("Load its exported mesh").setInputFiles({ name: "synthetic-pyramid.glb", mimeType: "model/gltf-binary", buffer: fixture });
  await page.locator("canvas").nth(1).waitFor();
  await page.locator("output").first().filter({ hasText: "FPS" }).waitFor();
  await visibleWorkspace();
  const canvas = page.locator("canvas").nth(1);
  const pixels = await canvas.screenshot();
  for (const resolution of [16, 24, 32]) {
    await page.getByLabel("Voxels per tile").selectOption(String(resolution));
    await page.waitForTimeout(200); assert.equal(await page.getByLabel("Voxels per tile").inputValue(), String(resolution));
  }
  assert.notDeepEqual(await canvas.screenshot(), pixels);
  for (const angle of [0, 180, 360]) { await changeRange("View rotation", angle); await visibleWorkspace(); }
  await changeRange("Horizontal extent", 1); await changeRange("Horizontal extent", 6);
  // The largest pyramid still fits the budget; if budget fails it must be readable.
  await changeRange("Horizontal extent", 3);
  await page.getByLabel("Turntable").check();
  const before = await canvas.screenshot(); await page.waitForTimeout(1200); assert.notDeepEqual(await canvas.screenshot(), before);
  await page.getByLabel("Turntable").uncheck();
  await page.screenshot({ path: new URL("synthetic-import.png", output).pathname, fullPage: true });
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Download voxel shell" }).click();
  const file = await download; const data = JSON.parse(await readFile(await file.path(), "utf8"));
  assert.equal(data.resolution, 32); assert.equal(data.collision, null); assert.ok(data.cells.length > 100); assert.equal(data.provenance.mesh, "synthetic-pyramid.glb");
  await page.setViewportSize({ width: 390, height: 844 }); await visibleWorkspace();
  await page.screenshot({ path: new URL("mobile.png", output).pathname, fullPage: true });
  await page.getByLabel("Original object").selectOption("tree");
  assert.equal(await page.locator("canvas").count(), 0);
  await page.getByLabel("Load its exported mesh").setInputFiles({ name: "bad.glb", mimeType: "model/gltf-binary", buffer: Buffer.from("invalid") });
  await page.getByRole("status").filter({ hasText: "self-contained GLB" }).waitFor();
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  await writeFile(new URL("check.json", output), JSON.stringify({ fixture: "synthetic pyramid, not SAM", checks: "four originals, GLB import, colored shell export, all resolutions, scale/rotation extremes, animated pixel change, scroll and mobile bounds, invalid import, no external requests", errors }, null, 2));
  console.log("Offline object comparison headless checks passed.");
} finally { await browser.close(); }
