"use client";

import { useEffect, useRef, useState } from "react";
import { ACCESSORY_PARTS, BODY_PARTS, CHARACTER_EXAMPLES, CHARACTER_MODELS, COLOR_KEYS, HAIR_PARTS, OUTFIT_PARTS, parseCharacterSpecification, type CharacterGeneration, type CharacterModel, type CharacterSpecification } from "./specification";
import { DIRECTIONS, paintSprite, renderCharacter, type Direction, type PixelDensity } from "./sprite";
import styles from "./character.module.css";
import ImageExperiment from "./image-experiment";

function SpritePreview({ specification, direction, density, scale, tempo, playing, frame }: {
  specification: CharacterSpecification; direction: Direction; density: PixelDensity; scale: number; tempo: number; playing: boolean; frame: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const height = Math.round(density * 4 / 3);
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
    let animation = 0;
    let start: number | undefined;
    let previous = -1;
    const tick = (now: number) => {
      start ??= now;
      const phase = playing ? Math.floor((now - start) * tempo / 1000) % 4 : frame;
      if (phase !== previous) {
        context.clearRect(0, 0, density, height);
        paintSprite(context, renderCharacter(specification, direction, phase, density));
        previous = phase;
      }
      if (playing) animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [specification, direction, density, height, tempo, playing, frame]);
  return <canvas ref={canvas} width={density} height={height} style={{ width: density * scale, height: height * scale }} aria-label={`${direction} character ${playing ? "walking" : `frame ${frame + 1}`}`} />;
}

function ContactSheet({ specification, density }: { specification: CharacterSpecification; density: PixelDensity }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const height = Math.round(density * 4 / 3);
  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, density * 4, height * 4);
    DIRECTIONS.forEach((direction, row) => {
      for (let frame = 0; frame < 4; frame++) paintSprite(context, renderCharacter(specification, direction, frame, density), frame * density, row * height);
    });
  }, [specification, density, height]);
  return <canvas ref={canvas} width={density * 4} height={height * 4} style={{ width: density * 8, height: height * 8 }} aria-label="Sprite sheet: south, west, north, east rows; four walking frames per row" />;
}

const fallbackLabels = {
  disabled: "Live generation is disabled.", credentials: "Live generation is unavailable without credentials.",
  provider: "The text model is unavailable.", "invalid-output": "The model returned an invalid character.",
};

function PaperDollExperiment() {
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
  const json = JSON.stringify({ experiment: "character-paper-doll", description, model, specification, settings: { scale, density, tempo, playing, frame }, result: { source: generation?.source ?? "example", model: generation?.model ?? null, fallbackReason: generation?.fallbackReason ?? null, edited } }, null, 2);

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
    <div className={styles.stage}>
      <div className={styles.preview}>
        <div className={styles.identity}><h2>{specification.name}</h2><p>{provenance}{edited ? " · edited locally" : ""}</p></div>
        <div className={styles.directions}>
          {DIRECTIONS.map(direction => <figure key={direction}>
            <div className={styles.sprite}><SpritePreview {...{ specification, direction, density, scale, tempo, playing, frame }} /></div>
            <figcaption>{direction}</figcaption>
          </figure>)}
        </div>
        <figure className={styles.sheet}>
          <ContactSheet {...{ specification, density }} />
          <figcaption>Four directions × four frames<br />South · west · north · east, top to bottom</figcaption>
        </figure>
      </div>
      <section className={styles.controls} aria-label="Character controls">
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
      <p>This finite parts library keeps colours and anatomy consistent across frames. Unavailable models use clearly labelled examples. Details beyond the available parts will need a larger library; this experiment does not generate new artwork.</p>
    </div>
    <details className={styles.json}><summary>Character & settings JSON</summary><textarea aria-label="Character and settings JSON" readOnly rows={16} value={json} /></details>
  </>;
}

export default function CharacterExperiment() {
  const [approach, setApproach] = useState("image");
  return <><div className={styles.approaches} role="group" aria-label="Character approach">
    <button aria-pressed={approach === "paper"} onClick={() => setApproach("paper")}>A · Paper doll</button>
    <button aria-pressed={approach === "image"} onClick={() => setApproach("image")}>B · Image model</button>
  </div><div hidden={approach !== "image"}><ImageExperiment /></div><div hidden={approach !== "paper"}><PaperDollExperiment /></div></>;
}
