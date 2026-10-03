"use client";
import { serializeWorld } from "@evermore/world";
import { useEffect, useMemo, useRef, useState } from "react";
import Preview from "./preview";
import type { Raster } from "./model";
import { ANNOTATIONS, type Annotation, type SceneId } from "./annotations";
import { compare, groundToScreen, type ComparisonSettings } from "./projection";
import { parseVisionProposal, type VisionProposal } from "./vision";
import styles from "./experiment.module.css";

const SOURCES = [
  { id: "cabin", label: "Forest cabin · evening", url: "/image-to-voxel/cabin.jpg", heightmap: "/image-to-voxel/cabin-height.png" },
  { id: "harbour", label: "Harbour town · evening", url: "/image-to-voxel/harbour.jpg", heightmap: "/image-to-voxel/harbour-height.png" },
] as const;
const COLORS = { roof: "#ffd36b", wall: "#ff9d92", bridge: "#89dfd5", water: "#9ebcff", other: "#ddd", unknown: "#f0f" };
type CachedVision = { proposal: VisionProposal; provenance: { model: string; durationMs: number; usage?: { promptTokenCount?: number; candidatesTokenCount?: number }; costUsd: number | null } };
type Correction = { source: string; durationMs: number; edits: number; start: ComparisonSettings; end: ComparisonSettings; annotations: Annotation[] };

async function loadRaster(url: string, dimensions?: { width: number; height: number }): Promise<Raster> {
  const image = new Image(); image.src = url; await image.decode();
  if (image.naturalWidth > 2048 || image.naturalHeight > 2048) throw new Error("Images must be at most 2048 × 2048 pixels.");
  const canvas = document.createElement("canvas");
  canvas.width = dimensions?.width ?? image.naturalWidth; canvas.height = dimensions?.height ?? image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is unavailable.");
  // The generated harbour suggestion is resized for sampling, not registered.
  context.imageSmoothingEnabled = false; context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
function download(bytes: Uint8Array | string, name: string, type: string) {
  const data = typeof bytes === "string" ? bytes : new Uint8Array(bytes).buffer;
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Experiment() {
  const initialSource: SceneId = new URLSearchParams(window.location.search).get("source") === "harbour" ? "harbour" : "cabin";
  const [sourceId, setSourceId] = useState<SceneId>(initialSource);
  const activeSource = useRef(initialSource);
  const source = SOURCES.find((s) => s.id === sourceId)!;
  const [settings, setSettings] = useState<ComparisonSettings>({ tileSize: 64, heightScale: 6, method: "heightmap", projection: "relief", useAnchors: true });
  const [images, setImages] = useState<{ id: string; source: Raster; heightmap: Raster; vision?: CachedVision }>();
  const [uploadedMap, setUploadedMap] = useState<{ id: string; raster: Raster; url: string }>();
  const [annotations, setAnnotations] = useState(() => structuredClone(ANNOTATIONS[initialSource]));
  const [selected, setSelected] = useState("roof");
  const [rotation, setRotation] = useState(0); const [hour, setHour] = useState(12);
  const [sourceColors, setSourceColors] = useState(true);
  const [view, setView] = useState("source"); const [grid, setGrid] = useState(true); const [masks, setMasks] = useState(true); const [points, setPoints] = useState(false);
  const [status, setStatus] = useState(""); const [error, setError] = useState("");
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const timer = useRef<{ at: number; edits: number; start: ComparisonSettings } | null>(null);
  const [recording, setRecording] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const raster = await loadRaster(source.url);
        const heightmap = await loadRaster(source.heightmap, source.id === "harbour" ? raster : undefined);
        const response = await fetch(`/image-to-voxel/${source.id}-vision.json`);
        let vision: CachedVision | undefined;
        if (response.ok) {
          const cached = await response.json() as CachedVision;
          vision = { ...cached, proposal: parseVisionProposal(cached.proposal, { sourceId: source.id, width: raster.width, height: raster.height, tileSize: 64 }) };
        }
        if (!cancelled) { setImages({ id: source.id, source: raster, heightmap, vision }); setError(""); }
      } catch (reason) { if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load images or validated vision tiles."); }
    }
    void load(); return () => { cancelled = true; };
  }, [source]);
  useEffect(() => () => { if (uploadedMap) URL.revokeObjectURL(uploadedMap.url); }, [uploadedMap]);
  const ready = images?.id === source.id ? images : undefined;
  const map = uploadedMap?.id === source.id ? uploadedMap.raster : ready?.heightmap;
  const conversion = useMemo(() => {
    if (!ready) return {};
    try { return { comparison: compare(ready.source, settings, annotations, map, ready.vision?.proposal) }; }
    catch (reason) { return { error: reason instanceof Error ? reason.message : "Reconstruction failed." }; }
  }, [ready, settings, annotations, map]);
  const comparison = conversion.comparison; const result = comparison?.result;
  const current = annotations.find(a => a.id === selected)!;
  const edit = (change: (a: Annotation) => Annotation) => {
    setAnnotations((values) => values.map(a => a.id === selected ? change(a) : a));
    if (timer.current) timer.current.edits++;
  };
  const json = JSON.stringify({ experiment: "image-to-voxel-comparison-v1", source: source.url, heightmap: uploadedMap?.id === source.id ? "user-supplied (retain original)" : source.heightmap, settings, annotations, camera: { inclination: 45, rotation, zoom: 1 }, hour, sourceColors, vision: ready?.vision?.provenance ?? null, metrics: comparison?.metrics, corrections, geometry: "observed surface shell; gaps and hidden layers unknown; unvalidated walkability" }, null, 2);
  return <div>
    <div className={styles.stage} data-testid="comparison-stage">
      <div className={styles.comparison}>
        <figure className={styles.figure}>
          <figcaption>{source.label} · {view}</figcaption>
          <div className={styles.source}>
            <div className={styles.sourceRaster} style={{ aspectRatio: ready ? `${ready.source.width} / ${ready.source.height}` : "1376 / 768" }}>
              {/* Native raster remains the source for sampling. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={view === "heightmap" ? uploadedMap?.id === source.id ? uploadedMap.url : source.heightmap : source.url} alt={`${source.label}: ${view}`} />
              {view === "vision" && ready?.vision && <svg className={styles.overlay} viewBox="0 0 1376 768" aria-label="Cached vision height tiles">
                {ready.vision.proposal.tiles.map(t => <rect key={`${t.x}-${t.y}`} x={t.x * 64} y={t.y * 64} width={64} height={64} fill={`rgb(${t.level * 51} ${t.level * 51} ${t.level * 51})`} fillOpacity=".8"><title>{t.region}: level {t.level}</title></rect>)}
              </svg>}
              {grid && ready && <div className={styles.grid} style={{ backgroundSize: `${settings.tileSize / ready.source.width * 100}% ${settings.tileSize / ready.source.height * 100}%` }} />}
              <svg className={styles.overlay} viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="Hand masks and ground anchors">
                {masks && annotations.map(a => <g key={a.id} onClick={() => setSelected(a.id)}>
                  <polygon points={a.polygon.map(p => `${p[0] * 1000},${p[1] * 1000}`).join(" ")} fill={COLORS[a.kind]} fillOpacity={a.id === selected ? .25 : .08} stroke={COLORS[a.kind]} strokeWidth={a.id === selected ? 4 : 2}><title>{a.label}</title></polygon>
                  <path d={`M${a.groundAnchor[0] * 1000 - 12},${a.groundAnchor[1] * 1000}h24 M${a.groundAnchor[0] * 1000},${a.groundAnchor[1] * 1000 - 12}v24`} stroke={COLORS[a.kind]} strokeWidth="3" />
                </g>)}
                {points && ready && comparison?.samples.map((s, i) => <circle key={i} cx={s.source[0] * 1000} cy={groundToScreen(s.ground[1] + .5, s.height) * settings.tileSize / ready.source.height * 1000} r="3" fill="#fff" />)}
              </svg>
            </div>
          </div>
          <p className={styles.caption}>Polygons: hand patches · crosses: ground contacts · dots: reprojection</p>
        </figure>
        <figure className={styles.figure}>
          <figcaption>R1 · {settings.projection} · {settings.method} · {rotation}°</figcaption>
          <div className={styles.result}>{result ? <Preview result={result} rotation={rotation} hour={hour} sourceColors={sourceColors} /> : <p role="status">{conversion.error ?? (error !== "" ? error : "Loading comparison…")}</p>}</div>
          <p className={styles.caption}>{result ? `${result.columns} × ${result.rows} ground cells · ${result.cells.toLocaleString()} shell voxels` : ""}</p>
        </figure>
      </div>
      <fieldset className={styles.controls}>
        <legend>Compare & correct</legend>
        <label>Test image<select aria-label="Test image" disabled={recording} value={source.id} onChange={(event) => {
          const id = event.target.value as SceneId; activeSource.current = id; setSourceId(id); setUploadedMap(undefined); setStatus(""); setAnnotations(structuredClone(ANNOTATIONS[id])); setView("source");
        }}>{SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <label>Height method<select aria-label="Method" value={settings.method} onChange={e => setSettings({ ...settings, method: e.target.value as ComparisonSettings["method"], tileSize: e.target.value === "vision" ? 64 : settings.tileSize })}>
          <option value="heuristic">Colour heuristic</option><option value="heightmap">Model / uploaded map</option><option value="vision" disabled={!ready?.vision}>Cached Vision-LLM · 64px</option>
        </select></label>
        <label>Geometry<select aria-label="Geometry" value={settings.projection} onChange={e => setSettings({ ...settings, projection: e.target.value as ComparisonSettings["projection"] })}><option value="relief">Image-space relief baseline</option><option value="projected">Inverse ground projection · 45°</option></select></label>
        <label>Tile size · {settings.tileSize}px<input aria-label="Tile size" type="range" min={8} max={64} step={8} disabled={settings.method === "vision"} value={settings.tileSize} onChange={e => setSettings({ ...settings, tileSize: Number(e.target.value) })} /></label>
        <label>Height scale · {settings.heightScale}<input aria-label="Height scale" type="range" min={0} max={12} value={settings.heightScale} onChange={e => setSettings({ ...settings, heightScale: Number(e.target.value) })} /></label>
        <label><input aria-label="Use hand anchors" type="checkbox" checked={settings.useAnchors} onChange={e => setSettings({ ...settings, useAnchors: e.target.checked })} /> Use hand masks / anchors</label>
        <label>Patch<select aria-label="Patch" value={selected} onChange={e => setSelected(e.target.value)}>{annotations.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
        <label>Patch level · {current.level}<input aria-label="Patch level" type="range" min={0} max={5} value={current.level} onChange={e => edit(a => ({ ...a, level: Number(e.target.value) }))} /></label>
        <label>Ground contact Y · {Math.round(current.groundAnchor[1] * 100)}%<input aria-label="Ground contact Y" type="range" min={0} max={100} value={current.groundAnchor[1] * 100} onChange={e => edit(a => ({ ...a, groundAnchor: [a.groundAnchor[0], Number(e.target.value) / 100] }))} /></label>
        <div className={styles.buttons}><button type="button" onClick={() => edit(a => ({ ...a, polygon: a.polygon.map(p => [p[0], Math.max(0, p[1] - .01)]) }))}>Mask ↑</button><button type="button" onClick={() => edit(a => ({ ...a, polygon: a.polygon.map(p => [p[0], Math.min(1, p[1] + .01)]) }))}>Mask ↓</button><button type="button" onClick={() => { setAnnotations(structuredClone(ANNOTATIONS[sourceId])); if (timer.current) timer.current.edits++; }}>Reset patches</button></div>
        <button type="button" onClick={() => {
          if (!timer.current) { timer.current = { at: performance.now(), edits: 0, start: { ...settings } }; setRecording(true); }
          else { const run = timer.current; setCorrections(values => [...values, { source: source.id, durationMs: Math.round(performance.now() - run.at), edits: run.edits, start: run.start, end: { ...settings }, annotations: structuredClone(annotations) }]); timer.current = null; setRecording(false); }
        }}>{recording ? "Stop correction timer" : "Start correction timer"}</button>
        <label>Source view<select aria-label="Source view" value={view} onChange={e => setView(e.target.value)}><option value="source">Original</option><option value="heightmap">Grayscale suggestion</option><option value="vision" disabled={!ready?.vision}>Vision height tiles</option></select></label>
        <div className={styles.buttons}><label><input type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)} /> Grid</label><label><input type="checkbox" checked={masks} onChange={e => setMasks(e.target.checked)} /> Masks</label><label><input type="checkbox" checked={points} onChange={e => setPoints(e.target.checked)} /> Reprojection</label></div>
        <label>Diagnostic turn · {rotation}°<input aria-label="Diagnostic turn" type="range" min={-20} max={20} value={rotation} onChange={e => setRotation(Number(e.target.value))} /></label>
        <label>Time · {hour}:00<input aria-label="Time of day" type="range" min={6} max={18} value={hour} onChange={e => setHour(Number(e.target.value))} /></label>
        <label><input type="checkbox" checked={sourceColors} onChange={e => setSourceColors(e.target.checked)} /> Sampled source colours</label>
        <button type="button" onClick={() => setRotation(0)}>Reset 2D camera</button>
      </fieldset>
    </div>
    <div className={styles.metrics} aria-label="Comparison metrics">
      <p><strong>Reprojection</strong> {comparison ? `${comparison.metrics.meanProjectionErrorPx.toFixed(1)}px mean / ${comparison.metrics.maxProjectionErrorPx.toFixed(1)}px max · ${comparison.metrics.collisions} overlaps · ${comparison.metrics.unknown} unknown tiles` : "Loading…"}</p>
      <p><strong>Vision mask IoU (local patches)</strong> {comparison && Object.entries(comparison.metrics.maskIoU).map(([id, v]) => `${id} ${v === null ? "n/a" : v.toFixed(2)}`).join(" · ")}</p>
      <p><strong>Raw height error (levels)</strong> {comparison?.metrics.heightErrors.map(a => `${a.id} ${a.actual}/${a.expected} (Δ${a.error})`).join(" · ")}</p>
      <p><strong>Correction sessions</strong> {recording ? "Recording… " : ""}{corrections.length > 0 ? corrections.map(c => `${c.source}: ${(c.durationMs / 1000).toFixed(1)}s, ${c.edits} edits`).join(" · ") : "None recorded"}</p>
      <p><strong>Cached model</strong> {ready?.vision ? `${ready.vision.provenance.model} · ${(ready.vision.provenance.durationMs / 1000).toFixed(1)}s · ${ready.vision.provenance.usage?.promptTokenCount ?? "?"} input / ${ready.vision.provenance.usage?.candidatesTokenCount ?? "?"} output tokens · cost unrecorded` : "Unavailable"}</p>
    </div>
    <p role="status" className={styles.caption}>{status}</p>
    {(error !== "" || conversion.error !== undefined) && <p role="alert">{error !== "" ? error : conversion.error}</p>}
    <div className={styles.notes}>
      <p><strong>Compare at 64px:</strong> keep the same motif, height scale and lighting. Switch height method and geometry separately. Hand masks / anchors override model heights only inside selected patches in projected mode. Move a mask or its ground contact and record the correction time.</p>
      <p>Reprojection error measures the fixed 45° camera equation and grid rounding, not real registration accuracy. Wall pixels collapse to their annotated ground contact; roof/deck samples are back-projected. Overlaps retain the upper surface; gaps, interiors and lower bridge layers stay unknown. Raw height error is measured before hand overrides. IoU only evaluates hand patches with a one-tile margin, not complete scene segmentation.</p>
      <p>Harbour height suggestion: generated with built-in imagegen, sampled from 1678 × 937 to 1376 × 768 using nearest neighbours. Textures and edge drift remain. Cabin uses the earlier Gemini map. Validated cached Vision-LLM output is still semantically uncertain; no live calls are made here. Painted lighting stays in source colours. This shell has no validated spawn, collision, bridge clearance or walkability.</p>
    </div>
    <div className={styles.actions}>
      <button disabled={!result} type="button" onClick={() => { if (result) download(serializeWorld(result.world), `${source.id}-${settings.projection}.evw`, "application/octet-stream"); }}>Save world (.evw)</button>
      <button disabled={!result} type="button" onClick={() => { if (result) download(JSON.stringify({ ...JSON.parse(json), columns: result.columns, rows: result.rows, tiles: result.tiles, samples: comparison?.samples }, null, 2), `${source.id}-comparison.json`, "application/json"); }}>Save comparison JSON</button>
      <button type="button" onClick={() => { if (typeof navigator.clipboard === "undefined") { setStatus("Select and copy the JSON below."); return; } void navigator.clipboard.writeText(json).then(() => setStatus("Copied settings and metrics."), () => setStatus("Select and copy the JSON below.")); }}>Copy settings</button>
      <label>Load matching grayscale heightmap<input type="file" accept="image/png" onChange={e => {
        const file = e.target.files?.[0]; if (!file || !ready) return;
        if (file.size > 10 * 1024 * 1024) { setError("Heightmap must be smaller than 10 MB."); return; }
        const id = source.id; const url = URL.createObjectURL(file);
        void loadRaster(url).then(raster => {
          if (activeSource.current !== id) { URL.revokeObjectURL(url); return; }
          if (raster.width !== ready.source.width || raster.height !== ready.source.height) throw new Error("Uploaded heightmap and source must have identical dimensions.");
          setUploadedMap({ id, raster, url }); setSettings(value => ({ ...value, method: "heightmap" })); setError(""); setStatus("Loaded map. Inspect registration.");
        }).catch((reason: unknown) => { URL.revokeObjectURL(url); if (activeSource.current === id) setError(reason instanceof Error ? reason.message : "Could not load map."); });
      }} /></label>
    </div>
    <p className={styles.caption}>.evw preserves sparse material geometry. Comparison JSON preserves colours, hand patches, settings, metrics and correction sessions.</p>
    <details><summary>Settings & measurements JSON</summary><textarea className="mt-2 w-full bg-black/30 p-3 font-mono text-sm" aria-label="Settings JSON" readOnly rows={12} value={json} /></details>
  </div>;
}
