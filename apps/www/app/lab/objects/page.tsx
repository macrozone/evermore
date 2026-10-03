"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { applyObjectPalette, objectLibrary, objectPalettes, OBJECT_TILE_SIZE, type LibraryObject, type ObjectPalette } from "../../../lib/objects";
import { OBJECT_MODELS, type ObjectModel, type ObjectGeneration, type GeneratedObject, type ObjectRate } from "./generation";
import { loadLocalObjects, saveLocalObject } from "./local-library";
import styles from "./objects.module.css";

function Sprite({ object, zoom, pixelSize, palette, footprint }: { object: LibraryObject; zoom: number; pixelSize: number; palette: ObjectPalette; footprint: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled || !ref.current) return;
      const canvas = ref.current;
      const context = canvas.getContext("2d");
      if (!context) return;
      canvas.width = object.width; canvas.height = object.height;
      context.imageSmoothingEnabled = false;
      const small = document.createElement("canvas");
      small.width = Math.ceil(object.width / pixelSize); small.height = Math.ceil(object.height / pixelSize);
      const smallContext = small.getContext("2d");
      if (!smallContext) return;
      smallContext.imageSmoothingEnabled = false;
      smallContext.drawImage(image, 0, 0, small.width, small.height);
      const pixels = smallContext.getImageData(0, 0, small.width, small.height);
      applyObjectPalette(pixels.data, objectPalettes[palette]);
      smallContext.putImageData(pixels, 0, 0);
      context.drawImage(small, 0, 0, object.width, object.height);
      if (footprint) {
        context.fillStyle = "#eba65566"; context.strokeStyle = "#f4cf82";
        const originX = (object.width - object.footprint.columns * OBJECT_TILE_SIZE) / 2;
        const originY = object.height - object.footprint.rows * OBJECT_TILE_SIZE;
        for (const [x, y] of object.footprint.collision) {
          const dx = originX + x * OBJECT_TILE_SIZE; const dy = originY + y * OBJECT_TILE_SIZE;
          context.fillRect(dx, dy, OBJECT_TILE_SIZE, OBJECT_TILE_SIZE);
          context.strokeRect(dx + 0.5, dy + 0.5, OBJECT_TILE_SIZE - 1, OBJECT_TILE_SIZE - 1);
        }
      }
      setError(false);
    };
    image.onerror = () => { if (!cancelled) setError(true); };
    image.src = object.sprite;
    return () => { cancelled = true; };
  }, [object, pixelSize, palette, footprint]);
  return error ? <p role="alert">Could not load {object.name}.</p> : <canvas ref={ref} width={object.width} height={object.height} style={{ width: object.width * zoom, height: object.height * zoom }} role="img" aria-label={`${object.name} sprite${footprint ? " with collision footprint" : ""}`} />;
}

const usd = (cost: number) => `$${cost.toFixed(4)}`;
function downloadMetadata(object: GeneratedObject) {
  const { raw: _raw, sprite: _sprite, ...metadata } = object;
  void _raw; void _sprite;
  const url = URL.createObjectURL(new Blob([JSON.stringify({ ...metadata, sprite: `${object.id}.png` }, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = `${object.id}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function ObjectsPage() {
  const [pixelSize, setPixelSize] = useState(1);
  const [palette, setPalette] = useState<ObjectPalette>("original");
  const [zoom, setZoom] = useState(3);
  const [footprint, setFootprint] = useState(false);
  const [prompt, setPrompt] = useState("A moss-covered stone village well");
  const [model, setModel] = useState<ObjectModel>(OBJECT_MODELS[0].id);
  const [kind, setKind] = useState<LibraryObject["kind"]>("decoration");
  const [seed, setSeed] = useState(1);
  const [variants, setVariants] = useState(2);
  const [customSize, setCustomSize] = useState(false);
  const [widthTiles, setWidthTiles] = useState(2);
  const [heightTiles, setHeightTiles] = useState(3);
  const [result, setResult] = useState<ObjectGeneration | null>(null);
  const [saved, setSaved] = useState<GeneratedObject[]>([]);
  const [rate, setRate] = useState<ObjectRate | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(false);
  const results = useRef<HTMLElement>(null);
  useEffect(() => {
    let cancelled = false;
    loadLocalObjects().then(objects => { if (!cancelled) setSaved(objects); }).catch(error => { if (!cancelled) setError(error.message); });
    const refresh = () => fetch("/api/lab/objects", { cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!cancelled) { setAvailable(response.ok); if (data.rate !== undefined) setRate(data.rate); }
    }).catch(() => { if (!cancelled) setAvailable(false); });
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 30_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);
  async function generate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/lab/objects", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model, kind, seed, variants, pixelSize, palette, ...(customSize ? { widthTiles, heightTiles } : {}) }) });
      const data = await response.json();
      if (data.rate !== undefined) setRate(data.rate);
      if (!response.ok) throw new Error(data.error ?? "Object generation failed.");
      setResult(data as ObjectGeneration);
      results.current?.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) { setError(error instanceof Error ? error.message : "Object generation failed."); }
    finally { setBusy(false); }
  }
  async function add(object: GeneratedObject) {
    try { await saveLocalObject(object); setSaved(previous => [object, ...previous.filter(item => item.id !== object.id)]); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not save locally."); }
  }
  const generatedCard = (object: GeneratedObject, local = false) => <article key={object.id} className={styles.card}>
    <div className={styles.comparison}>
      <figure><figcaption>Raw model image</figcaption>{/* Raw data URLs are intentionally displayed without Next image optimization. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={object.raw} alt={`Raw ${object.name}`} /></figure>
      <figure><figcaption>Prepared sprite</figcaption><div className={styles.preview}><Sprite object={object} zoom={zoom} pixelSize={1} palette="original" footprint={footprint} /></div></figure>
    </div>
    <div className={styles.details}><h3>{object.name}</h3><p>{object.model} · seed {object.seed} · {(object.durationMs / 1000).toFixed(1)} s · estimated {usd(object.estimatedCostUsd)}</p>
      <p>{object.width} × {object.height} px · pixel {object.pixelSize} · {object.palette} palette</p>
      <p>Estimated footprint: {object.footprint.columns} × {object.footprint.rows} ground tiles · {object.footprint.occupied.length} occupied / {object.footprint.collision.length} blocked · height {object.heightTiles}</p>
      <p>Heuristic only — review collision and height before world placement.</p>
      <div className={styles.actions}><a href={object.sprite} download={`${object.id}.png`}>Download PNG</a><button onClick={() => downloadMetadata(object)}>Download metadata</button>
        {!local && <button disabled={saved.some(item => item.id === object.id)} onClick={() => void add(object)}>{saved.some(item => item.id === object.id) ? "Saved locally" : "Add to local library"}</button>}</div>
    </div>
  </article>;
  return <main className={styles.page}>
    <nav><Link href="/">Evermore</Link><span> / </span><Link href="/lab">Lab</Link><span> / Objects</span></nav>
    <header className={styles.header}><p className={styles.eyebrow}>G2 · THE BUILDING BLOCKS</p><h1>Imagine one more piece.</h1><p>Wish for an object in the library’s cozy pixel-art style. Compare its raw image with a transparent, tile-sized sprite.</p></header>
    <div className={styles.workspace}>
      <aside className={styles.controls} aria-label="Object controls">
        <form onSubmit={event => { void generate(event); }}>
          <h2>Wish for an object</h2>
          <label>Object description<textarea maxLength={500} required value={prompt} onChange={event => setPrompt(event.target.value)} /></label>
          <label>Image model<select value={model} onChange={event => setModel(event.target.value as ObjectModel)}>{OBJECT_MODELS.map(item => <option key={item.id} value={item.id}>{item.label} · ~{usd(item.imageUsd)}/image</option>)}</select></label>
          <label>Object kind<select value={kind} onChange={event => setKind(event.target.value as LibraryObject["kind"])}><option value="decoration">Decoration</option><option value="building">Building</option><option value="vegetation">Vegetation</option></select></label>
          <div className={styles.fields}><label>Seed<input type="number" min="0" max="2147483643" required value={seed} onChange={event => setSeed(Number(event.target.value))} /></label>
            <label htmlFor="object-variants">Variants <output>{variants}</output><input id="object-variants" type="range" min="2" max="4" step="1" value={variants} onChange={event => setVariants(Number(event.target.value))} /></label></div>
          <label className={styles.checkbox}><input type="checkbox" checked={customSize} onChange={event => setCustomSize(event.target.checked)} />Specify sprite size in tiles</label>
          {customSize && <div className={styles.fields}><label>Width in tiles<input type="number" min="1" max="8" required value={widthTiles} onChange={event => setWidthTiles(Number(event.target.value))} /></label><label>Height in tiles<input type="number" min="1" max="8" required value={heightTiles} onChange={event => setHeightTiles(Number(event.target.value))} /></label></div>}
          <label htmlFor="object-pixels">Pixel size <output>{pixelSize} px</output><input id="object-pixels" type="range" min="1" max="4" step="1" value={pixelSize} onChange={event => setPixelSize(Number(event.target.value))} /></label>
          <label>Palette<select value={palette} onChange={event => setPalette(event.target.value as ObjectPalette)}><option value="original">Generated colors</option><option value="hearth">Warm hearth · 16 colors</option><option value="dusk">Quiet dusk · 16 colors</option></select></label>
          <button type="submit" disabled={busy || !available}>{busy ? "Imagining variants…" : `Generate ${variants} variants`}</button>
          <p>{available ? "Local development · Vertex ADC" : "Generation requires local development on localhost."}</p>
          <p role="status">{rate ? `${rate.used} / ${rate.limit} image calls in the last hour · next reset ${new Date(rate.resetsAt).toLocaleTimeString()}` : "Checking image-call budget…"}</p>
          <p>Estimated image cost: {usd(OBJECT_MODELS.find(item => item.id === model)!.imageUsd * variants)} + input/reasoning tokens. Cached settings cost $0. Seeds guide the model; new uncached outputs can vary.</p>
        </form>
        <section aria-label="Preview controls"><h2>Inspect the result</h2>
          <label htmlFor="object-zoom">Display scale <output>{zoom}×</output><input id="object-zoom" type="range" min="1" max="4" step="1" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>
          <label className={styles.checkbox}><input type="checkbox" checked={footprint} onChange={event => setFootprint(event.target.checked)} />Show collision footprints</label>
          <p>Pixel and palette controls prepare new sprites and preview the built-in library. Generated sprites retain their saved settings.</p>
        </section>
        {error !== "" && <p role="alert">{error}</p>}
      </aside>
      <section ref={results} className={styles.results} aria-label="Object results" aria-busy={busy}>
        {result && <><h2>Latest variants</h2><p role="status">{result.cached ? "Cache hit / shared request" : "Live generation"} · {(result.durationMs / 1000).toFixed(1)} s · this request estimated {usd(result.estimatedCostUsd)}</p>
          {result.errors.map(item => <p role="alert" key={item.seed}>Seed {item.seed}: {item.error}</p>)}<div className={styles.grid}>{result.objects.map(object => generatedCard(object))}</div></>}
        {saved.length > 0 && <><h2>Local library</h2><p>Saved in this browser, including after reload. Export PNG and metadata to keep a copy.</p><div className={styles.grid}>{saved.map(object => generatedCard(object, true))}</div></>}
        <h2>Built-in library</h2><div className={styles.grid}>{objectLibrary.map(object => <article key={object.id} className={styles.card}>
          <div className={styles.preview}><Sprite object={object} zoom={zoom} pixelSize={pixelSize} palette={palette} footprint={footprint} /></div>
          <div className={styles.details}><h3>{object.name}</h3><p>{object.width} × {object.height} px · {object.footprint.columns} × {object.footprint.rows} ground tiles</p><p>{object.footprint.collision.length} blocked cells · height {object.heightTiles} tiles</p><a href={object.sprite} download={`${object.id}.png`}>Download original sprite ↗</a></div>
        </article>)}</div>
        <footer>Axis-aligned south-facing view · shared library style and deterministic sprite preparation.<br />Built-in downloads contain the original sprite. Ground footprints in the built-in library are authored; live footprints are estimates.</footer>
      </section>
    </div>
  </main>;
}
