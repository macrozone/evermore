"use client";

import { useEffect, useRef, useState } from "react";
import { ACCESSORY_PARTS, BODY_PARTS, CHARACTER_EXAMPLES, CHARACTER_MODELS, COLOR_KEYS, HAIR_PARTS, OUTFIT_PARTS, parseCharacterSpecification, type CharacterGeneration, type CharacterModel, type CharacterSpecification } from "./specification";
import { DIRECTIONS, paintSprite, renderCharacter, type Direction, type PixelDensity } from "./sprite";
import { DEFAULT_VOXEL_SETTINGS, renderVoxelCharacter, type VoxelSettings } from "./voxel";
import styles from "./character.module.css";

type RenderMode = "paper-doll" | "voxel";
interface RenderOptions { renderMode: RenderMode; voxel: VoxelSettings }

function SpritePreview({ specification, direction, density, scale, tempo, playing, frame, renderMode, voxel }: {
  specification: CharacterSpecification; direction: Direction; density: PixelDensity; scale: number; tempo: number; playing: boolean; frame: number;
} & RenderOptions) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const height = Math.round(density * 4 / 3);
  const stats = useRef<HTMLOutputElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const parent = element?.parentElement;
    if (!element || !parent) return;
    const fit = () => {
      const fitted = Math.max(1, Math.min(scale, Math.floor(parent.clientWidth / density), Math.floor(parent.clientHeight / height)));
      element.style.width = `${density * fitted}px`;
      element.style.height = `${height * fitted}px`;
    };
    const observer = new ResizeObserver(fit);
    observer.observe(parent); fit();
    return () => observer.disconnect();
  }, [density, height, scale]);
  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    const renderStart = performance.now();
    const sprites = Array.from({ length: 4 }, (_, phase) => renderMode === "voxel" ? renderVoxelCharacter(specification, direction, phase, density, voxel) : renderCharacter(specification, direction, phase, density));
    const renderMs = (performance.now() - renderStart) / 4;
    const triangles = renderMode === "voxel" ? (sprites[0] as ReturnType<typeof renderVoxelCharacter>).triangles : 0;
    let sampleStart = performance.now(), sampleFrames = 0;
    let animation = 0;
    let start: number | undefined;
    let previous = -1;
    const tick = (now: number) => {
      start ??= now;
      const phase = playing ? Math.floor((now - start) * tempo / 1000) % 4 : frame;
      if (phase !== previous) {
        context.clearRect(0, 0, density, height);
        paintSprite(context, sprites[phase]!);
        previous = phase;
      }
      sampleFrames++;
      if (stats.current && (now - sampleStart >= 1000 || !playing)) {
        const fps = sampleFrames * 1000 / Math.max(1, now - sampleStart);
        stats.current.textContent = `${playing ? `${fps.toFixed(0)} FPS · ${(1000 / fps).toFixed(1)} ms/frame` : "Paused"} · ${renderMs.toFixed(1)} ms/baked sprite${renderMode === "voxel" ? ` · ${triangles} triangles · 0 GPU draw calls · 1 CPU pass` : ""}`;
        sampleStart = now; sampleFrames = 0;
      }
      if (playing) animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [specification, direction, density, height, tempo, playing, frame, renderMode, voxel]);
  return <><canvas ref={canvas} width={density} height={height} style={{ width: density * scale, height: height * scale }} aria-label={`${direction} character ${playing ? "walking" : `frame ${frame + 1}`}`} />{direction === "south" && <output className={styles.stats} ref={stats} aria-label="Render performance">Baking sprites…</output>}</>;
}

function ContactSheet({ specification, density, renderMode, voxel }: { specification: CharacterSpecification; density: PixelDensity } & RenderOptions) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const height = Math.round(density * 4 / 3);
  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, density * 4, height * 4);
    DIRECTIONS.forEach((direction, row) => {
      for (let frame = 0; frame < 4; frame++) paintSprite(context, renderMode === "voxel" ? renderVoxelCharacter(specification, direction, frame, density, voxel) : renderCharacter(specification, direction, frame, density), frame * density, row * height);
    });
  }, [specification, density, height, renderMode, voxel]);
  return <canvas ref={canvas} width={density * 4} height={height * 4} style={{ width: density * 8, height: height * 8 }} aria-label="Sprite sheet: south, west, north, east rows; four walking frames per row" />;
}

const fallbackLabels = {
  disabled: "Live generation is disabled.", credentials: "Live generation is unavailable without credentials.",
  provider: "The text model is unavailable.", "invalid-output": "The model returned an invalid character.",
};

export default function CharacterExperiment() {
  const [renderMode, setRenderMode] = useState<RenderMode>("paper-doll");
  const [voxel, setVoxel] = useState<VoxelSettings>(DEFAULT_VOXEL_SETTINGS);
  const [description, setDescription] = useState(CHARACTER_EXAMPLES[0]!.description);
  const [model, setModel] = useState<CharacterModel>(CHARACTER_MODELS[0]);
  const [specification, setSpecification] = useState<CharacterSpecification>(structuredClone(CHARACTER_EXAMPLES[0]!.specification));
  const [generation, setGeneration] = useState<CharacterGeneration>();
  const [provenance, setProvenance] = useState("Example character · Woodland botanist");
  const [edited, setEdited] = useState(false);
  const [density, setDensity] = useState<PixelDensity>(24);
  const [scale, setScale] = useState(4);
  const [tempo, setTempo] = useState(6);
  const [playing, setPlaying] = useState(true);
  const [frame, setFrame] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const json = JSON.stringify({ experiment: `character-${renderMode}`, description, model, specification, settings: { renderMode, scale, density, tempo, playing, frame, voxel }, result: { source: generation?.source ?? "example", model: generation?.model ?? null, fallbackReason: generation?.fallbackReason ?? null, edited } }, null, 2);

  async function generate() {
    setBusy(true); setError(""); setCopyStatus("");
    const controller = new AbortController();
    pending.current = controller;
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch("/api/lab/character", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description, model }), signal: controller.signal });
      if (!response.ok) throw new Error("Could not generate a character. Try again or choose an example.");
      const result = await response.json() as CharacterGeneration;
      const valid = parseCharacterSpecification(result.specification);
      setSpecification(valid); setGeneration(result); setEdited(false);
      setProvenance(result.source === "vertex" ? `Text model · ${result.model} · ${(result.durationMs / 1000).toFixed(1)}s` : `Example fallback · ${result.fallbackReason !== undefined ? fallbackLabels[result.fallbackReason] : "Live generation unavailable."} This is a preset, not a generated response.`);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not generate a character.");
      else setError("Generation stopped. Try again or choose an example.");
    } finally { clearTimeout(timer); pending.current = null; setBusy(false); }
  }
  function edit(next: CharacterSpecification) { setSpecification(next); setEdited(true); setCopyStatus(""); }

  return <>
    <div className={styles.stage} aria-label="Character workspace">
      <div className={styles.preview}>
        <div className={styles.identity}><h2>{specification.name}</h2><p>{provenance}{edited ? " · edited locally" : ""}</p></div>
        <div className={styles.directions}>
          {DIRECTIONS.map(direction => <figure key={direction}>
            <div className={styles.sprite}><SpritePreview {...{ specification, direction, density, scale, tempo, playing, frame, renderMode, voxel }} /></div>
            <figcaption>{direction}</figcaption>
          </figure>)}
        </div>
        <figure className={styles.sheet}>
          <ContactSheet {...{ specification, density, renderMode, voxel }} />
          <figcaption>Four directions × four frames<br />South · west · north · east, top to bottom</figcaption>
        </figure>
      </div>
      <section className={styles.controls} aria-label="Character controls">
        <label>Rendering<select aria-label="Rendering" value={renderMode} onChange={event => { setRenderMode(event.target.value as RenderMode); setCopyStatus(""); }}>
          <option value="paper-doll">Paper doll · A</option><option value="voxel">Voxel · C</option>
        </select></label>
        <p>{renderMode === "voxel" ? "A solid 3D figure, baked into pixel sprites. Light stays fixed while the traveller turns." : "Hand-drawn pixel layers from the same parts and colours."}</p>
        <form onSubmit={event => { event.preventDefault(); void generate(); }}>
          <label>Who are you?<textarea value={description} maxLength={2000} required rows={3} disabled={busy} onChange={event => setDescription(event.target.value)} /></label>
          <label>Text model<select value={model} disabled={busy} onChange={event => setModel(event.target.value as CharacterModel)}>
            {CHARACTER_MODELS.map((value, index) => <option key={value} value={value}>{["Flash-Lite", "Flash", "Pro"][index]} · {value}</option>)}
          </select></label>
          <button disabled={busy || description.trim().length === 0} type="submit">{busy ? "Choosing parts…" : "Create character"}</button>
        </form>
        <label>Try an example<select aria-label="Example character" value="" disabled={busy} onChange={event => {
          const example = CHARACTER_EXAMPLES[Number(event.target.value)];
          if (!example) return;
          setDescription(example.description); setSpecification(structuredClone(example.specification)); setGeneration(undefined); setEdited(false); setError(""); setCopyStatus(""); setProvenance(`Example character · ${example.specification.name}`);
        }}><option value="" disabled>Choose a preset</option>{CHARACTER_EXAMPLES.map((example, index) => <option key={index} value={index}>{example.specification.name}</option>)}</select></label>
        {error !== "" && <p role="alert">{error}</p>}
        <fieldset><legend>Preview</legend>
          <label>Size · {scale}× pixels<input aria-label="Size" type="range" min={2} max={6} value={scale} onChange={event => setScale(Number(event.target.value))} /></label>
          <label>Pixel density<select aria-label="Pixel density" value={density} onChange={event => setDensity(Number(event.target.value) as PixelDensity)}>{([16, 24, 32] as const).map(value => <option key={value} value={value}>{value} × {Math.round(value * 4 / 3)} pixels</option>)}</select></label>
          <label>Animation tempo · {tempo} fps<input aria-label="Animation tempo" type="range" min={1} max={12} value={tempo} onChange={event => setTempo(Number(event.target.value))} /></label>
          <label className={styles.check}><input type="checkbox" checked={playing} onChange={event => setPlaying(event.target.checked)} /> Play walk cycle</label>
          {!playing && <label>Frame · {frame + 1}<input aria-label="Frame" type="range" min={0} max={3} value={frame} onChange={event => setFrame(Number(event.target.value))} /></label>}
        </fieldset>
        {renderMode === "voxel" && <fieldset><legend>Voxel camera & light</legend>
          {([
            ["elevation", "Camera elevation", 20, 70, 1],
            ["lightAzimuth", "Light direction", -180, 180, 5],
            ["ambient", "Ambient light", .1, 1, .05],
            ["sunlight", "Sunlight", 0, 1.5, .05],
          ] as const).map(([key, label, min, max, step]) => <label key={key}>{label} · {voxel[key]}{key === "elevation" || key === "lightAzimuth" ? "°" : ""}<input aria-label={label} type="range" min={min} max={max} step={step} value={voxel[key]} onChange={event => { setVoxel(previous => ({ ...previous, [key]: Number(event.target.value) })); setCopyStatus(""); }} /></label>)}
          <button type="button" onClick={() => setVoxel(DEFAULT_VOXEL_SETTINGS)}>Reset camera & light</button>
        </fieldset>}
        <fieldset><legend>Parts & colours</legend>
          <div className={styles.parts}>
            {([["body", BODY_PARTS], ["hair", HAIR_PARTS], ["outfit", OUTFIT_PARTS], ["accessory", ACCESSORY_PARTS]] as const).map(([key, parts]) => <label key={key}>{key}<select disabled={busy} value={specification[key]} onChange={event => edit(parseCharacterSpecification({ ...specification, [key]: event.target.value }))}>{parts.map(part => <option key={part} value={part}>{part}</option>)}</select></label>)}
          </div>
          <div className={styles.colors}>{COLOR_KEYS.map(key => <label key={key}>{key}<input type="color" disabled={busy} value={specification.colors[key]} aria-label={`${key} colour`} onChange={event => edit({ ...specification, colors: { ...specification.colors, [key]: event.target.value } })} /></label>)}</div>
        </fieldset>
        <button type="button" onClick={() => {
          if (typeof navigator.clipboard === "undefined") { setCopyStatus("Select and copy the JSON below."); return; }
          void navigator.clipboard.writeText(json).then(() => setCopyStatus("Copied character and settings."), () => setCopyStatus("Select and copy the JSON below."));
        }}>Copy JSON</button>
        <p role="status">{busy ? "Choosing parts with the text model…" : copyStatus}</p>
      </section>
    </div>
    <div className={styles.notes}>
      <p><strong>What to inspect:</strong> compare the silhouette and accessory in every direction. Pause and scrub the frames to check feet, arm swing and hair. Size scales the display; pixel density changes the drawing grid.</p>
      {renderMode === "voxel" && <p><strong>Voxel comparison:</strong> joint rotation and depth keep the body consistent in every view; lighting reveals its blocky volumes. Compare with A using the same preset and density. Like A, this finite human parts library cannot create arbitrary creatures; image-generated artwork (B) is a separate experiment.</p>}
      <p>This finite parts library keeps colours and anatomy consistent across frames. Unavailable models use clearly labelled examples. Details beyond the available parts will need a larger library; this experiment does not generate new artwork.</p>
    </div>
    <details className={styles.json}><summary>Character & settings JSON</summary><textarea aria-label="Character and settings JSON" readOnly rows={16} value={json} /></details>
  </>;
}
