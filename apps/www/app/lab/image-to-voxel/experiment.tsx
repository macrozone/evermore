"use client";
import { serializeWorld } from "@evermore/world";
import { useEffect, useMemo, useRef, useState } from "react";
import Preview from "./preview";
import { reconstruct, type Raster, type Settings } from "./model";
import styles from "./experiment.module.css";

const SOURCES = [
  { id: "cabin", label: "Forest cabin · evening", url: "/image-to-voxel/cabin.jpg", heightmap: "/image-to-voxel/cabin-height.png" },
  { id: "harbour", label: "Harbour town · evening", url: "/image-to-voxel/harbour.jpg", heightmap: undefined },
] as const;

async function loadRaster(url: string): Promise<Raster> {
  const image = new Image();
  image.src = url;
  await image.decode();
  if (image.naturalWidth > 2048 || image.naturalHeight > 2048) throw new Error("Images must be at most 2048 × 2048 pixels.");
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is unavailable.");
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
function download(bytes: Uint8Array | string, name: string, type: string) {
  const data = typeof bytes === "string" ? bytes : new Uint8Array(bytes).buffer;
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Experiment() {
  const initialSource = new URLSearchParams(window.location.search).get("source") === "harbour" ? "harbour" : "cabin";
  const [sourceId, setSourceId] = useState(initialSource);
  const activeSource = useRef(initialSource);
  const source = SOURCES.find((s) => s.id === sourceId) ?? SOURCES[0];
  const [settings, setSettings] = useState<Settings>({ tileSize: 16, heightScale: 6, method: initialSource === "cabin" ? "heightmap" : "heuristic" });
  const [images, setImages] = useState<{ id: string; source: Raster; heightmap?: Raster }>();
  const [uploadedMap, setUploadedMap] = useState<{ id: string; raster: Raster }>();
  const [rotation, setRotation] = useState(0);
  const [hour, setHour] = useState(12);
  const [sourceColors, setSourceColors] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [grid, setGrid] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [raster, heightmap] = await Promise.all([loadRaster(source.url), source.heightmap !== undefined ? loadRaster(source.heightmap) : undefined]);
        if (!cancelled) { setImages({ id: source.id, source: raster, heightmap }); setError(""); }
      } catch (reason) { if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load images."); }
    }
    void load();
    return () => { cancelled = true; };
  }, [source]);
  const map = uploadedMap?.id === source.id ? uploadedMap.raster : images?.heightmap;
  const conversion = useMemo(() => {
    if (!images || images.id !== source.id) return {};
    try { return { result: reconstruct(images.source, settings, map) }; }
    catch (reason) { return { error: reason instanceof Error ? reason.message : "Reconstruction failed." }; }
  }, [images, source.id, settings, map]);
  const result = conversion.result;
  const json = JSON.stringify({ experiment: "image-to-voxel", source: source.url, heightmap: uploadedMap?.id === source.id ? "user-supplied (save original separately)" : source.heightmap ?? null, settings, camera: { inclination: 45, rotation, zoom: 1 }, hour, sourceColors, geometry: "image-space surface shell; unknown cells are air; not playable" }, null, 2);
  return <div>
    <div className={styles.stage}>
      <div className={styles.comparison}>
        <figure className={styles.figure}>
          <figcaption>Source · {showMap ? "model-drawn grayscale heightmap" : source.label}</figcaption>
          <div className={styles.source}>
            {/* Native image preserves the pixel raster used by the converter. */}
            <div className={styles.sourceRaster} style={{ aspectRatio: images?.id === source.id ? `${images.source.width} / ${images.source.height}` : "16 / 9" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={showMap && source.heightmap !== undefined ? source.heightmap : source.url} alt={showMap ? "Model-drawn height suggestion for the cabin" : source.label} />
            {grid && images?.id === source.id && <div className={styles.grid} style={{ backgroundSize: `${settings.tileSize / images.source.width * 100}% ${settings.tileSize / images.source.height * 100}%` }} />}
            </div>
          </div>
        </figure>
        <figure className={styles.figure}>
          <figcaption>R1 · {rotation === 0 ? "2D look · south view" : `${rotation}° diagnostic turn`}</figcaption>
          <div className={styles.result}>
            {result ? <Preview result={result} rotation={rotation} hour={hour} sourceColors={sourceColors} /> : <p role="status">{conversion.error ?? "Loading source…"}</p>}
          </div>
        </figure>
      </div>
      <fieldset className={styles.controls}>
        <legend>Reconstruction & view</legend>
        <label>Test image<select aria-label="Test image" value={source.id} onChange={(event) => {
          activeSource.current = event.target.value; setSourceId(event.target.value); setShowMap(false); setUploadedMap(undefined); setStatus("");
          setSettings((value) => ({ ...value, method: event.target.value === "cabin" ? "heightmap" : "heuristic" }));
        }}>{SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <label>Method<select aria-label="Method" value={settings.method} onChange={(event) => setSettings({ ...settings, method: event.target.value as Settings["method"] })}>
          <option value="heuristic">Colour heuristic</option>
          <option value="heightmap" disabled={!map || images?.id !== source.id}>Model / uploaded grayscale map</option>
        </select></label>
        <label>Tile size · {settings.tileSize}px<input aria-label="Tile size" type="range" min={8} max={64} step={8} value={settings.tileSize} onChange={(e) => setSettings({ ...settings, tileSize: Number(e.target.value) })} /></label>
        <label>Height scale · {settings.heightScale} cells<input aria-label="Height scale" type="range" min={0} max={12} step={1} value={settings.heightScale} onChange={(e) => setSettings({ ...settings, heightScale: Number(e.target.value) })} /></label>
        <label>Diagnostic turn · {rotation}°<input aria-label="Diagnostic turn" type="range" min={-20} max={20} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} /></label>
        <label>Time · {hour}:00<input aria-label="Time of day" type="range" min={6} max={18} value={hour} onChange={(e) => setHour(Number(e.target.value))} /></label>
        <label><input type="checkbox" checked={sourceColors} onChange={(e) => setSourceColors(e.target.checked)} /> Sampled source colours</label>
        <label><input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} /> Source tile grid</label>
        {source.heightmap !== undefined && <label><input type="checkbox" checked={showMap} onChange={(e) => setShowMap(e.target.checked)} /> Show model map</label>}
        <button type="button" onClick={() => setRotation(0)}>Reset 2D camera</button>
      </fieldset>
    </div>
    <p className="my-3 text-sm text-mist" role="status">{result ? `${result.columns} × ${result.rows} tiles · ${result.cells.toLocaleString()} surface / facade cells · rendered on demand` : ""} {status}</p>
    {(error !== "" || conversion.error !== undefined) && <p role="alert">{error !== "" ? error : conversion.error}</p>}
    <div className={styles.notes}>
      <p><strong>What to inspect:</strong> compare roof edges, river and bridge. Turn the camera slightly to reveal the empty backs and undersides. Set height to zero to separate colour sampling from extrusion; switch off source colours to inspect material guesses.</p>
      <p>This is an image-space relief: one tile in the picture becomes one ground-grid column. Roofs and front walls in a tilted drawing do not describe a ground footprint. R1’s 45° camera compresses depth and shifts raised surfaces upward; this prototype does not undo that projection. Bridges, interiors, walkability and collision are unvalidated. Missing cells mean unknown, not verified empty space.</p>
      <p>The cabin map is the existing Gemini image-to-image experiment, snapped to six grayscale levels. Harbour defaults to the heuristic until a matching map is supplied. Colour thresholds confuse foliage, light and materials; source colours contain baked lighting. No live model call is made. Vision-LLM proposals and object / ground-anchor correction remain open comparisons.</p>
    </div>
    <div className={styles.actions}>
      <button disabled={!result} type="button" onClick={() => { if (result) download(serializeWorld(result.world), `${source.id}-relief.evw`, "application/octet-stream"); }}>Save world (.evw)</button>
      <button disabled={!result} type="button" onClick={() => { if (result) download(JSON.stringify({ ...JSON.parse(json), columns: result.columns, rows: result.rows, tiles: result.tiles }, null, 2), `${source.id}-relief.json`, "application/json"); }}>Save settings & tile colours</button>
      <button type="button" onClick={() => {
        if (typeof navigator.clipboard === "undefined") { setStatus("Select and copy the settings below."); return; }
        void navigator.clipboard.writeText(json).then(() => setStatus("Copied settings."), () => setStatus("Select and copy the settings below."));
      }}>Copy settings</button>
      <label>Load matching grayscale heightmap<input type="file" accept="image/png" onChange={(event) => {
        const file = event.target.files?.[0]; if (!file) return;
        const id = source.id;
        if (file.size > 10 * 1024 * 1024) { setError("Heightmap must be smaller than 10 MB."); return; }
        const url = URL.createObjectURL(file);
        void loadRaster(url).then((raster) => {
          if (activeSource.current !== id) return;
          if (!images || raster.width !== images.source.width || raster.height !== images.source.height) throw new Error("Heightmap and source must have identical dimensions.");
          setUploadedMap({ id, raster }); setSettings((value) => ({ ...value, method: "heightmap" })); setError(""); setStatus("Loaded heightmap. Inspect alignment against the source.");
        }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load map.")).finally(() => URL.revokeObjectURL(url));
      }} /></label>
    </div>
    <p className="my-3 text-sm text-mist">The .evw file uses packages/world serialization and stores material IDs with the incomplete geometry. The JSON companion preserves source colours and reconstruction settings. This shell has no validated player spawn.</p>
    <details><summary>Settings JSON</summary><textarea className="mt-2 w-full bg-black/30 p-3 font-mono text-sm" aria-label="Settings JSON" readOnly rows={16} value={json} /></details>
  </div>;
}
