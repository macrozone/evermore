"use client";
import { serializeWorld, getMaterial } from "@evermore/world";
import { useEffect, useMemo, useRef, useState } from "react";
import { analyse, exportAnalysis, PALETTE, type Raster, type Settings, type Analysis, type Layer } from "./model";
import { MAP_MODELS, parseMapInput, reservationUsd, type GeneratedMap, type MapBudget, type MapGeneration } from "./generation";
import styles from "./map.module.css";

const SOURCES = [
  { id: "cabin", label: "it2 · Forest cabin (evening)", url: "/moodboards/02-eigene-welt/images/it2-waldhuette-abend.jpg" },
  { id: "harbour", label: "it2 · Harbour (evening)", url: "/moodboards/02-eigene-welt/images/it2-hafenstadt-abend.jpg" },
] as const;
type View = "materials" | "height" | Layer | "uncertainty";
const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
async function loadRaster(url: string): Promise<Raster> {
  const image = new Image(); image.src = url; await image.decode();
  if (image.naturalWidth > 2048 || image.naturalHeight > 2048) throw new Error("Image exceeds the 2048 × 2048 pixel limit.");
  const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is unavailable.");
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
function save(data: string | Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([typeof data === "string" ? data : new Uint8Array(data).buffer], { type }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, size: number) {
  ctx.strokeStyle = "#ffffff60"; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < width; x += size) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, height); }
  for (let y = 0; y < height; y += size) { ctx.moveTo(0, y + .5); ctx.lineTo(width, y + .5); }
  ctx.stroke();
}
function Result({ raster, result, settings, view, grid, zoom }: { raster: Raster; result: Analysis; settings: Settings; view: View; grid: boolean; zoom: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, raster.width, raster.height);
    for (let i = 0; i < result.tiles.length; i++) {
      const tile = result.tiles[i]!, x = i % result.columns, y = Math.floor(i / result.columns);
      const absent = tile.material === null || (["ground", "object", "overhead"].includes(view) && tile.layer !== view);
      let color = absent ? ((x + y) % 2 !== 0 ? "#473549" : "#302c3d") : hex(getMaterial(tile.material!).color);
      if (view === "height" && !absent) { const gray = settings.heightScale === 0 ? 0 : Math.round(tile.height! / settings.heightScale * 255); color = `rgb(${gray},${gray},${gray})`; }
      if (view === "uncertainty") color = tile.material === null ? "#df75c1" : `hsl(${Math.round((1 - tile.distance) * 130)} 45% 40%)`;
      ctx.fillStyle = color; ctx.fillRect(x * settings.tileSize, y * settings.tileSize, settings.tileSize, settings.tileSize);
    }
    if (grid) drawGrid(ctx, raster.width, raster.height, settings.tileSize);
  }, [raster, result, settings, view, grid]);
  return <div className={`${styles.raster} ${styles.result}`} style={{ width: `${zoom * 100}%` }}><canvas ref={canvas} width={raster.width} height={raster.height} aria-label="Layered map result" /></div>;
}
function Source({ url, raster, tileSize, grid, zoom }: { url: string; raster: Raster; tileSize: number; grid: boolean; zoom: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, raster.width, raster.height);
    if (grid) drawGrid(ctx, raster.width, raster.height, tileSize);
  }, [raster, tileSize, grid]);
  return <div className={styles.raster} style={{ width: `${zoom * 100}%` }}>
    {/* Data URLs and pixel-accurate image sampling do not use the image optimizer. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={url} width={raster.width} height={raster.height} alt="Source map for colour analysis" />
    <canvas ref={canvas} width={raster.width} height={raster.height} aria-hidden />
  </div>;
}
export default function Experiment() {
  const [sourceId, setSourceId] = useState(() => new URLSearchParams(window.location.search).get("source") === "harbour" ? "harbour" : "cabin");
  const [live, setLive] = useState<GeneratedMap>();
  const [image, setImage] = useState<{ url: string; raster: Raster }>();
  const [imageError, setImageError] = useState("");
  const [settings, setSettings] = useState<Settings>({ tileSize: 32, maxDistance: .22, heightScale: 6 });
  const [view, setView] = useState<View>("materials"), [grid, setGrid] = useState(true), [zoom, setZoom] = useState(1);
  const [prompt, setPrompt] = useState("A forest clearing with a small cabin, a winding dirt path, a pond and tall trees.");
  const [model, setModel] = useState<typeof MAP_MODELS[number]["id"]>(MAP_MODELS[0].id), [seed, setSeed] = useState(1);
  const [budget, setBudget] = useState<MapBudget>(), [access, setAccess] = useState("Checking local live access…");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [generation, setGeneration] = useState<MapGeneration>();
  const requestId = useRef(0);
  const mounted = useRef(true);
  const source = SOURCES.find(entry => entry.id === sourceId);
  const url = source?.url ?? live?.image;
  useEffect(() => {
    let cancelled = false;
    if (url === undefined) return;
    void loadRaster(url).then(raster => { if (!cancelled) { setImage({ url, raster }); setImageError(""); } }).catch((reason: unknown) => { if (!cancelled) setImageError(reason instanceof Error ? reason.message : "Could not load image."); });
    return () => { cancelled = true; };
  }, [url]);
  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    void fetch("/api/lab/g3-map").then(async response => {
      const data = await response.json() as { budget?: MapBudget; error?: string };
      if (cancelled) return;
      if (!response.ok) { setAccess(data.error ?? "Live maps unavailable."); return; }
      setBudget(data.budget); setAccess("Local Vertex · server-side ADC");
    }).catch(() => { if (!cancelled) setAccess("Cannot check live access. Offline samples remain available."); });
    return () => { cancelled = true; mounted.current = false; };
  }, []);
  const ready = image && image.url === url ? image.raster : undefined;
  const result = useMemo(() => ready ? analyse(ready, settings) : undefined, [ready, settings]);
  const reservation = reservationUsd({ prompt, model, seed });
  const provenance = source ? { kind: "moodboard", ...source } : { kind: "Vertex", ...live, image: undefined };
  async function generate() {
    let input;
    try { input = parseMapInput({ prompt, model, seed }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Invalid settings."); return; }
    const id = ++requestId.current; setBusy(true); setError("");
    try {
      const response = await fetch("/api/lab/g3-map", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(110_000) });
      const data = await response.json() as MapGeneration & { error?: string }; if (!mounted.current || id !== requestId.current) return;
      if (data.budget !== undefined) setBudget(data.budget);
      if (!response.ok) throw new Error(data.error ?? "Map generation failed.");
      const generated = data as MapGeneration;
      setLive(generated.map); setGeneration(generated); setSourceId("live");
    } catch (reason) { if (mounted.current && id === requestId.current) setError(reason instanceof Error ? reason.message : "Map generation failed."); }
    finally { if (mounted.current && id === requestId.current) setBusy(false); }
  }
  return <>
    <section className={styles.stage} aria-label="Map comparison and controls">
      <div className={styles.views}>
        <figure className={styles.figure}><figcaption>Source · {source?.label ?? "Vertex map"}</figcaption><div className={styles.viewport}>{ready && url !== undefined ? <Source url={url} raster={ready} tileSize={settings.tileSize} grid={grid} zoom={zoom} /> : <p role="status">{imageError !== "" ? imageError : "Loading source…"}</p>}</div></figure>
        <figure className={styles.figure}><figcaption>{view} · {view === "height" ? "heuristic elevation" : "colour hypothesis"}</figcaption><div className={styles.viewport}>{ready && result && <Result raster={ready} result={result} settings={settings} view={view} grid={grid} zoom={zoom} />}</div></figure>
      </div>
      <aside className={styles.controls} aria-label="Map controls">
        <label>Source<select aria-label="Source" value={sourceId} onChange={e => { requestId.current++; setBusy(false); setSourceId(e.target.value); }}>
          {SOURCES.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}{live && <option value="live">Latest Vertex map</option>}
        </select></label>
        <label>Grid size · {settings.tileSize} px<input aria-label="Grid size" type="range" min={8} max={128} step={8} value={settings.tileSize} onChange={e => setSettings({ ...settings, tileSize: Number(e.target.value) })} /></label>
        <label>Max colour distance · {settings.maxDistance.toFixed(2)}<input aria-label="Uncertainty threshold" type="range" min={0} max={.6} step={.01} value={settings.maxDistance} onChange={e => setSettings({ ...settings, maxDistance: Number(e.target.value) })} /></label>
        <label>Heuristic height · {settings.heightScale}<input aria-label="Height scale" type="range" min={0} max={12} value={settings.heightScale} onChange={e => setSettings({ ...settings, heightScale: Number(e.target.value) })} /></label>
        <label>Result view<select aria-label="Result view" value={view} onChange={e => setView(e.target.value as View)}>{["materials", "height", "ground", "object", "overhead", "uncertainty"].map(mode => <option key={mode}>{mode}</option>)}</select></label>
        <label>Zoom · {zoom.toFixed(2)}×<input aria-label="Zoom" type="range" min={.5} max={3} step={.25} value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label>
        <label><input type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)} /> Grid overlay</label>
        <p className={styles.note}>Lower distance is stricter. Near ties stay unknown. Checkerboard = unknown / unobserved; pink marks uncertainty.</p>
        {result && <p className={styles.metrics} data-testid="map-metrics">{result.columns} × {result.rows} tiles · {result.unknown} unknown ({(result.unknown / result.tiles.length * 100).toFixed(1)}%) · ground {result.layers.ground.filter(v => v !== null).length} / object {result.layers.object.filter(v => v !== null).length} / overhead {result.layers.overhead.filter(v => v !== null).length}</p>}
        <button disabled={!result} onClick={() => { if (result) save(JSON.stringify(exportAnalysis(result, settings, provenance), null, 2), `g3-${sourceId}.json`, "application/json"); }}>Export layers + provenance</button>
        <button disabled={!result} onClick={() => { if (result) save(serializeWorld(result.world), `g3-${sourceId}-observed.evw`, "application/octet-stream"); }}>Export sparse world (.evw)</button>
        <p className={styles.note}>Export JSON alongside EVW: omitted world cells are unknown. No valid spawn or collision is inferred.</p>
        <fieldset><legend>Generate an axis-aligned map</legend>
          <label>Map description<textarea aria-label="Map description" maxLength={500} rows={3} value={prompt} onChange={e => setPrompt(e.target.value)} /></label>
          <label>Image model<select aria-label="Image model" value={model} onChange={e => setModel(e.target.value as typeof model)}>{MAP_MODELS.map(entry => <option key={entry.id} value={entry.id}>{entry.label} · ~${entry.imageUsd.toFixed(4)} / 1K image</option>)}</select></label>
          <label>Seed<input type="number" min={0} max={2147483647} value={seed} onChange={e => setSeed(Number(e.target.value))} /></label>
          <p className={styles.note}>{access}</p>
          <p className={styles.note}>Estimated reservation: ${reservation.toFixed(3)}. {budget ? `$${budget.reservedUsd.toFixed(3)} / $${budget.limitUsd.toFixed(2)} reserved this hour · ${budget.calls}/${budget.callLimit} calls. First reservation expires ${new Date(budget.resetsAt).toLocaleTimeString()}.` : "Live is limited to local development."}</p>
          <button disabled={busy || !budget || prompt.trim() === ""} onClick={() => void generate()}>{busy ? "Drawing map…" : "Generate map"}</button>
          <p className={styles.note}>Shared per server process; failures retain reservations. Restart resets it. Price estimates are not a billing cap. Same settings reuse cache; seed reproducibility is model-dependent.</p>
          {generation && <p className={styles.metrics} role="status">{(generation.durationMs / 1000).toFixed(1)}s · {generation.cached ? "cache hit · $0 new cost" : `~$${generation.requestCostUsd.toFixed(4)} ${generation.map.costBasis === "image-only" ? "image only; token usage unavailable" : "usage estimate"}`} · original {(generation.map.durationMs / 1000).toFixed(1)}s</p>}
          {error !== "" && <p role="alert" className={styles.error}>{error}</p>}
        </fieldset>
      </aside>
    </section>
    <div className={styles.legend}>{PALETTE.map(entry => <span key={entry.material}><i className={styles.swatch} style={{ background: hex(getMaterial(entry.material).color) }} />{getMaterial(entry.material).key} · {entry.layer}</span>)}</div>
    <div className={styles.notes}>
      <p>Median RGB → ten-colour palette. Distance is normalized RGB error, not a semantic confidence score. Dark grass can become canopy; warm lighting can become a roof. The layer view deliberately leaves everything underneath an observed roof or tree unknown.</p>
      <p>Height = material level × height scale / 4. A colour cannot establish terrain elevation, building entrances, bridges, floors or collision. Source and result share image-space coordinates; southern facades may occupy cells that do not correspond to ground positions.</p>
      <p>The live prompt requests an orthogonal whole map, separately from the object-library prompt. Compare the same grid and threshold across sources, then inspect material boundaries and missing ground. This experiment exports observations for analysis, not a playable scene.</p>
      <p><a className="underline" href="https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing">Vertex global standard pricing</a> · checked 2026-10-04. Image estimates use 1K output prices; text and reasoning are added when complete usage is available.</p>
    </div>
  </>;
}
