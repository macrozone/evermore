import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const origin = process.env.CHARACTER_CHECK_ORIGIN ?? "http://127.0.0.1:9400";
const output = path.resolve("../../docs/lab/screenshots");
await mkdir(output, { recursive: true });
const cache = path.resolve(".next/character-check");
await mkdir(cache, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], results = [];
page.on("pageerror", error => errors.push(error.message));
try {
  if (process.env.CHARACTER_CHECK_REPLAY === "true") {
    const { readFile } = await import("node:fs/promises");
    const { prepareCharacterSheet } = await import("../app/api/lab/character/image/prepare.ts");
    const names = ["pirate", "smile", "blue-hat", "donkey", "sorceress"];
    let index = 0;
    await page.route("**/api/lab/character/image", async route => {
      const body = JSON.parse(await readFile(path.join(cache, `${names[index++]}.json`), "utf8"));
      const character = body.character;
      if (character) {
        const prepared = await prepareCharacterSheet(Buffer.from(character.raw.split(",")[1], "base64"));
        Object.assign(character, prepared, { sheet: `data:image/png;base64,${prepared.sheet.toString("base64")}` });
      }
      await route.fulfill({ status: body.character ? 200 : 502, json: body });
    });
  }
  await page.goto(`${origin}/lab/character`);
  const controls = page.getByRole("region", { name: "Image character controls" });
  await controls.waitFor();
  for (const [name, prompt, edit] of [["pirate", "I am a pirate with a red hat.", false], ["smile", "Make the character smile.", true], ["blue-hat", "Make only the hat blue.", true], ["donkey", "I am a donkey.", false], ["sorceress", "I am a sorceress with a golden staff.", false]]) {
    await controls.getByLabel(edit ? "Edit selected character" : "Who are you?").fill(prompt);
    const response = page.waitForResponse(r => r.url().endsWith("/api/lab/character/image") && r.request().method() === "POST", { timeout: 240_000 });
    await controls.getByRole("button", { name: edit ? "Apply text edit" : "Create image character", exact: true }).click();
    const received = await response, body = await received.json();
    if (process.env.CHARACTER_CHECK_REPLAY !== "true") await writeFile(path.join(cache, `${name}.json`), JSON.stringify(body));
    await controls.getByRole("button", { name: "Create image character", exact: true }).waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(output, `character-image-${name}.png`), fullPage: true });
    const character = body.character;
    if (character) await writeFile(path.join(output, `character-image-${name}-raw.png`), Buffer.from(character.raw.split(",")[1], "base64"));
    const result = { name, status: received.status(), error: body.error, ...(character ? { id: character.id, parentId: character.parentId, model: character.model, durationMs: character.durationMs, estimatedCostUsd: character.estimatedCostUsd, calls: character.calls, frames: character.frames } : {}) };
    results.push(result); console.log(JSON.stringify(result));
    if (!received.ok()) break;
  }
  if (results[0]?.status === 200) {
    const canvas = page.getByLabel("Animated directions and four by four sprite sheet");
    const before = await canvas.evaluate(el => el.toDataURL());
    await page.waitForTimeout(450);
    const after = await canvas.evaluate(el => el.toDataURL());
    if (before === after) throw new Error("Animation pixels did not change.");
    const scene = page.getByLabel("Character movement scene");
    const worldBefore = await scene.evaluate(el => el.toDataURL());
    await scene.focus(); await page.keyboard.down("ArrowRight"); await page.waitForTimeout(800); await page.keyboard.up("ArrowRight");
    if (worldBefore === await scene.evaluate(el => el.toDataURL())) throw new Error("Movement scene did not change.");
    await controls.getByLabel("Play walk cycle").uncheck();
    await controls.getByLabel("Frame", { exact: false }).fill("3");
    for (const density of ["16", "32"]) {
      await controls.getByLabel("Pixel density").selectOption(density);
      await controls.getByLabel("Size", { exact: true }).fill(density === "16" ? "1" : "6");
      await controls.getByLabel("Animation tempo", { exact: true }).fill(density === "16" ? "1" : "12");
      await page.screenshot({ path: path.join(output, `character-image-extreme-${density}.png`), fullPage: true });
    }
    await page.getByRole("button", { name: "A · Paper doll", exact: true }).click();
    await page.getByRole("button", { name: "B · Image model", exact: true }).click();
    if (await controls.getByRole("button", { name: / · (Edit|New) · / }).count() !== results.length) throw new Error("A/B switch lost history.");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 350));
    await page.screenshot({ path: path.join(output, "character-image-mobile.png"), fullPage: true });
    const bounds = await controls.boundingBox();
    const sheetBounds = await canvas.boundingBox();
    if (!bounds || !sheetBounds || bounds.y < sheetBounds.y + sheetBounds.height) throw new Error("Mobile panel overlaps sprite sheet.");
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error("Horizontal overflow.");
  }
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await writeFile(path.join(output, "character-image-measurements.json"), JSON.stringify({ replayedPreparation: process.env.CHARACTER_CHECK_REPLAY === "true", results, browserErrors: errors }, null, 2));
  await browser.close();
}
