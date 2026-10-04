"use client";
/* eslint-disable @next/next/no-img-element -- Raw local generated PNGs are intentionally unoptimized. */

import { useEffect, useRef, useState } from "react";
import { createMovement, createMovementClock, DEFAULT_MOVEMENT, stepMovement } from "@evermore/core";
import { applyObjectPalette } from "../../../lib/objects";
import { CHARACTER_IMAGE_MODELS, CHARACTER_PALETTES, type CharacterPalette, type ImageCharacter, type ImageGeneration, type ImageModel } from "./image-specification";
import { DIRECTIONS } from "./sprite";
import styles from "./character.module.css";

function useSheet(character: ImageCharacter | undefined, density: number, palette: CharacterPalette) {
  const [sheet, setSheet] = useState<HTMLCanvasElement>();
  useEffect(() => {
    if (!character) return;
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      const canvas = document.createElement("canvas"), height = Math.round(density * 4 / 3);
      canvas.width = density * 4; canvas.height = height * 4;
      const context = canvas.getContext("2d")!;
      context.imageSmoothingEnabled = false;
      for (let row = 0; row < 4; row++) for (let frame = 0; frame < 4; frame++) context.drawImage(image, frame * character.frameWidth, row * character.frameHeight, character.frameWidth, character.frameHeight, frame * density, row * height, density, height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      applyObjectPalette(pixels.data, CHARACTER_PALETTES[palette]); context.putImageData(pixels, 0, 0);
      setSheet(canvas);
    };
    image.src = character.sheet;
    return () => { active = false; };
  }, [character, density, palette]);
  return sheet;
}

function ImagePreview({ sheet, density, scale, tempo, playing, frame }: { sheet: HTMLCanvasElement | undefined; density: number; scale: number; tempo: number; playing: boolean; frame: number }) {
  const canvas = useRef<HTMLCanvasElement>(null), scene = useRef<HTMLCanvasElement>(null), stats = useRef<HTMLOutputElement>(null);
  const keys = useRef(new Set<string>()), manual = useRef(false);
  useEffect(() => {
    const element = scene.current;
    if (!element) return;
    const down = (event: KeyboardEvent) => { if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(event.key)) { event.preventDefault(); keys.current.add(event.key); manual.current = true; } };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key);
    const clear = () => keys.current.clear();
    element.addEventListener("keydown", down); element.addEventListener("keyup", up); element.addEventListener("blur", clear);
    return () => { element.removeEventListener("keydown", down); element.removeEventListener("keyup", up); element.removeEventListener("blur", clear); };
  }, []);
  useEffect(() => {
    const context = canvas.current?.getContext("2d"), world = scene.current?.getContext("2d");
    if (!context || !world || !sheet) return;
    let animation = 0, start = 0, previous = 0, samples = 0, sampleTime = 0;
    const height = Math.round(density * 4 / 3), state = createMovement({ x: 4, y: 3, z: 0 }), clock = createMovementClock();
    const tick = (time: number) => {
      start ||= time; previous ||= time; sampleTime ||= time;
      const elapsed = (time - previous) / 1000; previous = time;
      const phase = playing ? Math.floor((time - start) * tempo / 1000) % 4 : frame;
      context.clearRect(0, 0, 4 * density, 5 * height + 4);
      context.imageSmoothingEnabled = false;
      for (let row = 0; row < 4; row++) context.drawImage(sheet, phase * density, row * height, density, height, row * density, 0, density, height);
      context.drawImage(sheet, 0, 0, density * 4, height * 4, 0, height + 4, density * 4, height * 4);
      clock(elapsed, () => {
        const k = keys.current;
        const route = Math.floor((time - start) / 2000) % 4;
        const auto = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }][route]!;
        const input = !playing ? { x: 0, y: 0 } : manual.current ? { x: Number(k.has("ArrowRight") || k.has("d")) - Number(k.has("ArrowLeft") || k.has("a")), y: Number(k.has("ArrowDown") || k.has("s")) - Number(k.has("ArrowUp") || k.has("w")) } : auto;
        stepMovement(state, input, { ...DEFAULT_MOVEMENT, speed: 1.2 }, p => p.x > 1 && p.x < 15 && p.y > 1 && p.y < 10 ? 0 : null);
      });
      world.fillStyle = "#304934"; world.fillRect(0, 0, 256, 176);
      world.fillStyle = "#b09668"; world.fillRect(24, 80, 208, 24); world.fillRect(104, 20, 24, 140);
      world.strokeStyle = "#75896730";
      for (let x = 0; x < 256; x += 16) { world.beginPath(); world.moveTo(x, 0); world.lineTo(x, 176); world.stroke(); }
      for (let y = 0; y < 176; y += 16) { world.beginPath(); world.moveTo(0, y); world.lineTo(256, y); world.stroke(); }
      const facing = state.facing.includes("east") ? "east" : state.facing.includes("west") ? "west" : state.facing === "north" ? "north" : "south";
      const row = DIRECTIONS.indexOf(facing), walk = playing && state.moving ? Math.floor(state.walkTime * tempo) % 4 : frame;
      world.imageSmoothingEnabled = false;
      world.drawImage(sheet, walk * density, row * height, density, height, Math.round(state.x * 16 - density / 2), Math.round(state.y * 16 - height), density, height);
      samples++;
      if (time - sampleTime >= 500) { const fps = samples * 1000 / (time - sampleTime); if (stats.current) stats.current.value = `${fps.toFixed(0)} FPS · ${(1000 / fps).toFixed(1)} ms`; samples = 0; sampleTime = time; }
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [sheet, density, tempo, playing, frame]);
  const height = Math.round(density * 4 / 3);
  return <>
    <figure className={styles.imageSheet}><canvas ref={canvas} width={density * 4} height={height * 5 + 4} style={{ width: density * 4 * scale }} aria-label="Animated directions and four by four sprite sheet" /><figcaption>South · west · north · east. Four walk phases per row.</figcaption></figure>
    <figure className={styles.scene}><canvas ref={scene} width={256} height={176} tabIndex={0} aria-label="Character movement scene" /><figcaption>Click the scene: arrow keys / WASD. Walks automatically until you take control. <output ref={stats}>Measuring FPS…</output></figcaption></figure>
  </>;
}

export default function ImageExperiment() {
  const [description, setDescription] = useState("I am a pirate with a red hat.");
  const [edit, setEdit] = useState("Make the hat blue.");
  const [model, setModel] = useState<ImageModel>(CHARACTER_IMAGE_MODELS[0].id);
  const [variants, setVariants] = useState<ImageCharacter[]>([]), [selected, setSelected] = useState("");
  const character = variants.find(v => v.id === selected);
  const [density, setDensity] = useState(24), [scale, setScale] = useState(3), [tempo, setTempo] = useState(6), [playing, setPlaying] = useState(true), [frame, setFrame] = useState(0);
  const [palette, setPalette] = useState<CharacterPalette>("original");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState(""), [used, setUsed] = useState(0);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const sheet = useSheet(character, density, palette);
  async function generate(editing: boolean) {
    const controller = new AbortController(); pending.current = controller;
    const timer = setTimeout(() => controller.abort(), 220_000);
    setBusy(true); setError(""); setStatus("");
    try {
      const response = await fetch("/api/lab/character/image", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ description: editing ? edit : description, model, ...(editing ? { referenceId: character!.id } : {}) }) });
      const body = await response.json() as ImageGeneration & { error?: string; calls?: ImageCharacter["calls"] };
      if (body.rate !== undefined) setUsed(body.rate.used);
      if (!response.ok) {
        const cost = body.calls?.reduce((sum: number, call: { estimatedCostUsd: number }) => sum + call.estimatedCostUsd, 0) ?? 0;
        throw new Error(`${body.error ?? "Image generation failed."}${cost > 0 ? ` Completed calls cost an estimated $${cost.toFixed(4)}.` : ""}`);
      }
      const result = body as ImageGeneration;
      setVariants(previous => [...previous, result.character].slice(-8)); setSelected(result.character.id);
      setStatus("Variant saved in local memory. Inspect every direction before accepting it.");
    } catch (reason) { setError(controller.signal.aborted ? "Generation stopped. Calls already sent may still incur cost." : reason instanceof Error ? reason.message : "Image generation failed."); }
    finally { clearTimeout(timer); pending.current = null; setBusy(false); }
  }
  const json = JSON.stringify({ experiment: "character-image", description, model, character: character ? { ...character, raw: "See raw image download", reference: "See reference download", sheet: "See sheet download" } : null, settings: { density, scale, tempo, playing, frame, palette } }, null, 2);
  return <>
    <div className={`${styles.stage} ${styles.imageStage}`}>
      <div className={styles.preview}>
        <div className={styles.identity}><h2>{character ? character.description : "Image model · Character B"}</h2><p>{character ? `${character.model} · ${(character.durationMs / 1000).toFixed(1)} s · ${character.calls.length} calls · estimated $${character.estimatedCostUsd.toFixed(4)}` : "Describe anyone, including an animal. Two image calls create a reference and a walking sheet; one call edits the selected sheet."}</p></div>
        {character ? <ImagePreview {...{ sheet, density, scale, tempo, playing, frame }} /> : <div className={styles.empty}>Your generated character will appear here.<br />No preset is substituted for the image model.</div>}
      </div>
      <section className={styles.controls} aria-label="Image character controls">
        <form onSubmit={e => { e.preventDefault(); void generate(false); }}>
          <label>Who are you?<textarea value={description} rows={3} maxLength={2000} required disabled={busy} onChange={e => setDescription(e.target.value)} /></label>
          <label>Image model<select value={model} disabled={busy} onChange={e => setModel(e.target.value as ImageModel)}>{CHARACTER_IMAGE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label} · {m.id}</option>)}</select></label>
          <button disabled={busy || description.trim() === ""}>Create image character</button>
        </form>
        <label>Try a description<select value="" disabled={busy} onChange={e => setDescription(e.target.value)}><option value="" disabled>Choose a prompt</option>{["I am a pirate with a red hat.", "I am a donkey.", "I am a sorceress with a golden staff."].map(p => <option key={p}>{p}</option>)}</select></label>
        <form onSubmit={e => { e.preventDefault(); void generate(true); }}>
          <label>Edit selected character<textarea value={edit} rows={2} maxLength={2000} disabled={busy} onChange={e => setEdit(e.target.value)} /></label>
          <button disabled={busy || !character || edit.trim() === ""}>Apply text edit</button>
        </form>
        <p>Estimated image output: ${(CHARACTER_IMAGE_MODELS.find(m => m.id === model)!.imageUsd * 2).toFixed(4)} / new character, ${(CHARACTER_IMAGE_MODELS.find(m => m.id === model)!.imageUsd).toFixed(4)} / edit, plus input and reasoning tokens. {used}/20 hourly calls reserved. Local development only.</p>
        {error !== "" && <p role="alert">{error}</p>}
        <p role="status">{busy ? "Generating artwork… this may take up to three minutes." : status}</p>
        <fieldset><legend>Variants · local memory (8)</legend><div className={styles.history}>{variants.map((v, i) => <button type="button" key={v.id} disabled={busy} aria-pressed={selected === v.id} onClick={() => setSelected(v.id)}>{i + 1} · {v.parentId !== undefined ? "Edit" : "New"} · {v.description}</button>)}</div></fieldset>
        <fieldset><legend>Preview · no model calls</legend>
          <label>Size · {scale}×<input aria-label="Size" type="range" min={1} max={6} value={scale} onChange={e => setScale(Number(e.target.value))} /></label>
          <label>Pixel density<select aria-label="Pixel density" value={density} onChange={e => setDensity(Number(e.target.value))}>{[16, 24, 32].map(v => <option key={v} value={v}>{v} × {Math.round(v * 4 / 3)}</option>)}</select></label>
          <label>Palette<select value={palette} onChange={e => setPalette(e.target.value as CharacterPalette)}><option value="hearth">Warm hearth · world palette</option><option value="dusk">Quiet dusk · world palette</option><option value="original">Generated colors · shared 32-color palette</option></select></label>
          <label>Animation tempo · {tempo} fps<input aria-label="Animation tempo" type="range" min={1} max={12} value={tempo} onChange={e => setTempo(Number(e.target.value))} /></label>
          <label className={styles.check}><input type="checkbox" checked={playing} onChange={e => setPlaying(e.target.checked)} /> Play walk cycle</label>
          {!playing && <label>Frame · {frame + 1}<input aria-label="Frame" type="range" min={0} max={3} value={frame} onChange={e => setFrame(Number(e.target.value))} /></label>}
        </fieldset>
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(json).then(() => setStatus("Copied character and settings."), () => setStatus("Copy the JSON below.")); }}>Copy JSON</button>
      </section>
    </div>
    {character && <details className={styles.json}><summary>Raw images, measurements & call costs</summary>
      <p>Shared crop, scale and foot baseline across all 16 cells. Width, height and foot position variation below are diagnostics, not a guarantee of identity consistency.</p>
      <p>{character.calls.map(c => `${c.stage}: ${(c.durationMs / 1000).toFixed(1)} s / ~$${c.estimatedCostUsd.toFixed(4)}`).join(" · ")}</p>
      <div className={styles.rawImages}>{/* Data URLs are intentionally unoptimized, local generated images. */}<a href={character.reference} download="character-reference.png"><img src={character.reference} alt="Original character reference" />Download reference</a><a href={character.raw} download="character-raw-sheet.png"><img src={character.raw} alt="Current raw sprite sheet" />Download raw sheet</a><a href={sheet?.toDataURL()} download="character-pixel-sheet.png">Download current pixel sheet</a></div>
      <table><thead><tr><th>Direction / frame</th><th>Width</th><th>Height</th><th>Foot Y</th><th>Pixels</th></tr></thead><tbody>{character.frames.map((m, i) => <tr key={i}><td>{DIRECTIONS[Math.floor(i / 4)]} / {i % 4 + 1}</td><td>{m.width}</td><td>{m.height}</td><td>{m.bottom}</td><td>{m.pixels}</td></tr>)}</tbody></table>
    </details>}
    <div className={styles.notes}><p>Compare B with A: A reuses a limited parts library and guarantees matching anatomy. B can invent any species or outfit, but inspect all 16 frames for identity drift, extra limbs, clipped hats and foot jitter. Text edits use the selected high-resolution sheet as their reference.</p><p>Variants disappear on reload or server restart; older references may expire. Each successful call shows its estimated cost and latency. Background removal reserves magenta; avoid pure magenta clothing.</p></div>
    <details className={styles.json}><summary>Character & settings JSON</summary><textarea aria-label="Character and settings JSON" readOnly rows={12} value={json} /></details>
  </>;
}
