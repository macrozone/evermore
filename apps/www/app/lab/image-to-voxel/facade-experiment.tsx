"use client";
import { serializeWorld } from "@evermore/world";
import { useEffect, useMemo, useRef, useState } from "react";
import { HEIGHT_MODELS } from "../../../lib/heightmap-config.mjs";
import Preview from "./preview";
import { reconstruct, type Raster, type Settings } from "./model";
import styles from "./experiment.module.css";

const SOURCES = [
  { id: "cabin", label: "Forest cabin · evening", url: "/image-to-voxel/cabin.jpg", heightmap: "/image-to-voxel/cabin-height.png", top: "/image-to-voxel/cabin-top-height.png", facade: "/image-to-voxel/cabin-facade.png", depth: "/image-to-voxel/cabin-depth.png" },
  { id: "harbour", label: "Harbour town · evening", url: "/image-to-voxel/harbour.jpg", heightmap: "/image-to-voxel/harbour-height.png", top: undefined, facade: undefined, depth: undefined },
] as const;
type Pair = { id: string; height: string; facade: string; heightRaster: Raster; facadeRaster: Raster; metadata?: unknown };
async function loadRaster(url: string, dimensions?: { width: number; height: number }): Promise<Raster> {
  const image = new Image(); image.src = url; await image.decode();
  if (image.naturalWidth > 2048 || image.naturalHeight > 2048) throw new Error("Images must be at most 2048 × 2048 pixels.");
  const canvas = document.createElement("canvas"); canvas.width = dimensions?.width ?? image.naturalWidth; canvas.height = dimensions?.height ?? image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is unavailable.");
  context.imageSmoothingEnabled = false; context.drawImage(image, 0, 0, canvas.width, canvas.height); return context.getImageData(0, 0, canvas.width, canvas.height);
}
function download(bytes: Uint8Array | string, name: string, type: string) {
  const data = typeof bytes === "string" ? bytes : new Uint8Array(bytes).buffer;
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadImage(url: string, name: string) {
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
}

export default function Experiment() {
  const initial = new URLSearchParams(window.location.search).get("source") === "harbour" ? "harbour" : "cabin";
  const [sourceId, setSourceId] = useState(initial);
  const activeSource = useRef(initial);
  const source = SOURCES.find(item => item.id === sourceId) ?? SOURCES[0];
  const [settings, setSettings] = useState<Settings>({ tileSize: 16, heightScale: 10, method: initial === "cabin" ? "facade" : "heuristic" });
  const [images, setImages] = useState<{ id: string; source: Raster; legacy?: Raster; pair?: Pair }>();
  const [customPair, setCustomPair] = useState<Pair>();
  const [uploaded, setUploaded] = useState<{ id: string; height: string; raster: Raster }>();
  const [rotation, setRotation] = useState(0), [hour, setHour] = useState(12);
  const [sourceColors, setSourceColors] = useState(false), [grid, setGrid] = useState(false);
  const [model, setModel] = useState(HEIGHT_MODELS[0]!.id), [seed, setSeed] = useState(1), [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(""), [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raster = await loadRaster(source.url);
        const [legacy, top, facade, metadata] = await Promise.all([
          loadRaster(source.heightmap, source.id === "harbour" ? raster : undefined),
          source.top !== undefined ? loadRaster(source.top) : undefined, source.facade !== undefined ? loadRaster(source.facade) : undefined,
          source.top !== undefined ? fetch("/image-to-voxel/cabin-top-run.json").then(response => response.json()) : undefined,
        ]);
        if (!cancelled) { setImages({ id: source.id, source: raster, legacy, pair: top && facade ? { id: source.id, height: source.top!, facade: source.facade!, heightRaster: top, facadeRaster: facade, metadata } : undefined }); setError(""); }
      } catch (reason) { if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load maps."); }
    })();
    return () => { cancelled = true; };
  }, [source]);
  const pair = customPair?.id === source.id ? customPair : images?.id === source.id ? images.pair : undefined;
  const legacy = uploaded?.id === source.id ? uploaded.raster : images?.legacy;
  const map = settings.method === "facade" ? pair?.heightRaster : legacy;
  const conversion = useMemo(() => {
    if (!images || images.id !== source.id) return {};
    try { return { result: reconstruct(images.source, settings, map, pair?.facadeRaster) }; }
    catch (reason) { return { error: reason instanceof Error ? reason.message : "Reconstruction failed." }; }
  }, [images, source.id, settings, map, pair]);
  const result = conversion.result;
  const heightUrl = settings.method === "facade" ? pair?.height : uploaded?.id === source.id ? uploaded.height : source.heightmap;
  const json = JSON.stringify({ experiment: "image-to-voxel-iteration-3", source: source.url, settings, camera: { inclination: 45, rotation }, hour, sourceColors, generation: pair?.metadata ?? null, geometry: settings.method === "facade" ? "tops shifted by height; visible walls share a ground anchor; unknown runs omitted" : "legacy image-space shell", unresolvedFacades: result?.unresolvedFacades ?? 0 }, null, 2);
  async function generate() {
    if (busy) return;
    const id = source.id;
    setBusy(true); setError(""); setStatus("Generating top labels and extracting the facade mask…");
    try {
      const response = await fetch("/api/lab/image-to-voxel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: id, model, seed }) });
      const data = await response.json() as { error?: string; heightmap: string; facade: string; metadata: { durationMs: number; estimatedCostUsd: number }; cached: boolean };
      if (!response.ok) throw new Error(data.error ?? "Generation failed.");
      const [heightRaster, facadeRaster] = await Promise.all([loadRaster(data.heightmap), loadRaster(data.facade)]);
      if (activeSource.current !== id) return;
      setCustomPair({ id, height: data.heightmap, facade: data.facade, heightRaster, facadeRaster, metadata: data.metadata });
      setSettings(value => ({ ...value, method: "facade" }));
      setStatus(`${data.cached === true ? "Cached" : "Generated"} · ${(data.metadata.durationMs / 1000).toFixed(1)}s · estimated $${data.metadata.estimatedCostUsd.toFixed(4)}${data.cached === true ? " original call; $0 new cost" : ""}. Inspect label alignment.`);
    } catch (reason) { if (activeSource.current === id) { setError(reason instanceof Error ? reason.message : "Generation failed."); setStatus(""); } }
    finally { setBusy(false); }
  }
  function figure(title: string, url?: string, alt = title) {
    return <figure className={styles.figure}><figcaption>{title}</figcaption><div className={styles.source}>
      {url !== undefined ? <div className={styles.sourceRaster} style={{ aspectRatio: images?.id === source.id ? `${images.source.width} / ${images.source.height}` : "16 / 9" }}>
        {/* Native image preserves label codes and pixel alignment. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={alt} />
        {grid && images?.id === source.id && <div className={styles.grid} style={{ backgroundSize: `${settings.tileSize / images.source.width * 100}% ${settings.tileSize / images.source.height * 100}%` }} />}
      </div> : <p>Generate a matching map for this source.</p>}
    </div></figure>;
  }
  return <div>
    <div className={styles.stage} data-testid="facade-stage">
      <div className={`${styles.comparison} ${styles.mapComparison}`}>
        {figure(`Original · ${source.label}`, source.url)}
        {figure(settings.method === "facade" ? "Top heights · six flat levels" : "Legacy height suggestion", heightUrl)}
        {figure("Facade mask · white = vertical", pair?.facade)}
        <figure className={styles.figure}><figcaption>Voxel · {rotation === 0 ? "45° south view" : `${rotation}° diagnostic turn`}</figcaption><div className={styles.result}>
          {result ? <Preview result={result} rotation={rotation} hour={hour} sourceColors={sourceColors} /> : <p role="status">{conversion.error ?? "Loading source…"}</p>}
        </div></figure>
      </div>
      <fieldset className={styles.controls}><legend>Reconstruction & generation</legend>
        <label>Test image<select aria-label="Test image" value={source.id} onChange={event => {
          activeSource.current = event.target.value; setSourceId(event.target.value); setUploaded(undefined); setCustomPair(undefined); setStatus(""); setError("");
          setSettings(value => ({ ...value, method: event.target.value === "cabin" ? "facade" : "heuristic" }));
        }}>{SOURCES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>Method<select aria-label="Method" value={settings.method} onChange={event => setSettings({ ...settings, method: event.target.value as Settings["method"] })}>
          <option value="facade" disabled={!pair}>Top heights + anchored facades</option><option value="heightmap" disabled={!legacy || images?.id !== source.id}>Legacy / uploaded grayscale</option><option value="heuristic">Colour heuristic</option>
        </select></label>
        <label>Tile size · {settings.tileSize}px<input aria-label="Tile size" type="range" min={8} max={64} step={8} value={settings.tileSize} onChange={event => setSettings({ ...settings, tileSize: Number(event.target.value) })} /></label>
        <label>Height scale · {settings.heightScale} cells<input aria-label="Height scale" type="range" min={0} max={12} value={settings.heightScale} onChange={event => setSettings({ ...settings, heightScale: Number(event.target.value) })} /></label>
        <label>Diagnostic turn · {rotation}°<input aria-label="Diagnostic turn" type="range" min={-20} max={20} value={rotation} onChange={event => setRotation(Number(event.target.value))} /></label>
        <label>Time · {hour}:00<input aria-label="Time of day" type="range" min={6} max={18} value={hour} onChange={event => setHour(Number(event.target.value))} /></label>
        <label><input type="checkbox" checked={sourceColors} onChange={event => setSourceColors(event.target.checked)} /> Source colours (off = height tones)</label>
        <label><input type="checkbox" checked={grid} onChange={event => setGrid(event.target.checked)} /> Tile grid</label>
        <label>Image model<select aria-label="Image model" value={model} onChange={event => setModel(event.target.value)}>{HEIGHT_MODELS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>Seed<input aria-label="Seed" type="number" min={0} max={2147483647} value={seed} onChange={event => setSeed(Number(event.target.value))} /></label>
        <button disabled={busy || !Number.isInteger(seed) || seed < 0 || seed > 2147483647} type="button" onClick={() => void generate()}>{busy ? "Generating…" : "Generate height + facade maps"}</button>
        <span className={styles.estimate}>One image call · ≈${HEIGHT_MODELS.find(item => item.id === model)!.imageUsd.toFixed(4)} + input / thinking · local development only</span>
        <button type="button" onClick={() => setRotation(0)}>Reset 2D camera</button>
      </fieldset>
    </div>
    <p className="my-3 text-sm text-mist" role="status">{result ? `${result.columns} × ${result.rows} image tiles · ${result.cells.toLocaleString()} cells · ${result.unresolvedFacades ?? 0} facade columns without valid anchors` : ""} {status}</p>
    {(error !== "" || conversion.error !== undefined) && <p role="alert">{error !== "" ? error : conversion.error}</p>}
    <div className={styles.notes}>
      <p>Legend: 0 water · 51 ground/paths · 102 bridge/fence tops · 153 low tops · 204 eaves/crowns · 255 ridge/highest tops. Black areas under white facade labels are excluded, not water. Wall heights come only from top and ground anchors, linearly down each mask column; timber and lighting never determine wall height.</p>
      <p>Turn slightly to inspect walls. Tops undo the 45° height shift; each facade shares one ground coordinate from its bottom anchor. Missing or reversed anchors are omitted and counted. This is an incomplete shell, with approximate registration and roof junctions, unvalidated collision and no player spawn. Source colours still contain baked lighting.</p>
    </div>
    <div className={styles.actions}>
      <button disabled={!result} type="button" onClick={() => { if (result) download(serializeWorld(result.world), `${source.id}-relief.evw`, "application/octet-stream"); }}>Save world (.evw)</button>
      <button type="button" onClick={() => download(JSON.stringify({ ...JSON.parse(json), tiles: result?.tiles, cellColors: result?.cellColors ? Object.fromEntries(result.cellColors) : undefined }, null, 2), `${source.id}-relief.json`, "application/json")}>Save settings & cost</button>
      <button disabled={!pair} type="button" onClick={() => { if (pair) downloadImage(pair.height, `${source.id}-top-height.png`); }}>Save heightmap</button>
      <button disabled={!pair} type="button" onClick={() => { if (pair) downloadImage(pair.facade, `${source.id}-facade.png`); }}>Save facade mask</button>
      <label>Load legacy matching heightmap<input type="file" accept="image/png" onChange={event => {
        const file = event.target.files?.[0]; if (!file) return;
        const id = source.id, expected = images?.source;
        if (file.size > 10 * 1024 * 1024) { setError("Heightmap must be smaller than 10 MB."); return; }
        const reader = new FileReader(); reader.onload = () => {
          const url = String(reader.result);
          void loadRaster(url).then(raster => {
            if (activeSource.current !== id) return;
            if (!expected || raster.width !== expected.width || raster.height !== expected.height) throw new Error("Heightmap and source must have identical dimensions.");
            setUploaded({ id, height: url, raster }); setSettings(value => ({ ...value, method: "heightmap" })); setError("");
          }).catch(reason => { if (activeSource.current === id) setError(reason instanceof Error ? reason.message : "Could not load map."); });
        }; reader.readAsDataURL(file);
      }} /></label>
    </div>
    {source.depth !== undefined && <details className={`${styles.depthBaseline} my-4`}><summary>Depth Anything V2 Small · relative camera-depth baseline</summary><p className="my-2 text-sm text-mist">Near/far depth is not ground height. This CPU baseline is shown for comparison only; it is never used as a facade heightmap.</p>{figure("Relative camera proximity · normalized per image", source.depth)}</details>}
    <details><summary>Settings JSON · model, prompt, tokens and cost</summary><textarea className="mt-2 w-full bg-black/30 p-3 font-mono text-sm" aria-label="Settings JSON" readOnly rows={16} value={json} /></details>
  </div>;
}
