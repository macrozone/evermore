"use client";
import { useEffect, useRef, useState } from "react";
import { createMovement, createMovementClock, DEFAULT_MOVEMENT, stepMovement } from "@evermore/core";
import { useMovement } from "../../../components/lab/use-movement";
import { movementFromKeys } from "../../../components/lab/keyboard";
import { movementSprite } from "../../../components/lab/movement-sprite";
import { SOURCES, rasterizeRegions, safeSpawn, type Masks, type MaskResult } from "../g3b-map/model";
import { DIRECTIONS, OVERLAP, approachingEdges, tileOrigin, worldWalkable, worldOccluded, blendWeight, type Direction, type Seam, type ChunkRecord } from "./model";
import { MAP_MODELS, VISION_MODELS } from "./generation";
import { savedChunk, storeChunk } from "./storage";
import styles from "./map.module.css";
async function loadImage(url: string) { const image = new Image(); image.src = url; await image.decode(); return image; }
type Tile = {
    direction?: Direction;
    image: HTMLImageElement;
    masks: Masks;
    overhead: HTMLCanvasElement;
    red: HTMLCanvasElement;
    blue: HTMLCanvasElement;
    context?: HTMLCanvasElement;
    record?: ChunkRecord;
};
function overlay(masks: Masks, kind: "collision" | "overhead", colour: number[]) {
    const canvas = document.createElement("canvas");
    canvas.width = masks.width;
    canvas.height = masks.height;
    const ctx = canvas.getContext("2d")!, data = ctx.createImageData(masks.width, masks.height);
    for (let i = 0; i < masks[kind].length; i++)
        if (masks[kind][i] === 1)
            data.data.set(colour, i * 4);
    ctx.putImageData(data, 0, 0);
    return canvas;
}
async function makeTile(url: string, result: MaskResult, record?: ChunkRecord): Promise<Tile> {
    if (!result.regions)
        throw new Error("Chunk has no Vision polygons.");
    const image = await loadImage(url);
    if (image.naturalWidth !== result.width || image.naturalHeight !== result.height)
        throw new Error("Chunk image and mask dimensions differ.");
    const masks = rasterizeRegions(result.width, result.height, result.regions), overhead = overlay(masks, "overhead", [255, 255, 255, 255]);
    const ctx = overhead.getContext("2d")!;
    ctx.globalCompositeOperation = "source-in";
    ctx.drawImage(image, 0, 0);
    let context: HTMLCanvasElement | undefined;
    if (record) {
        const strip = await loadImage(record.context), horizontal = record.direction === "east" || record.direction === "west";
        if (strip.naturalWidth !== (horizontal ? record.overlap : record.width) || strip.naturalHeight !== (horizontal ? record.height : record.overlap))
            throw new Error("Invalid overlap strip.");
        context = document.createElement("canvas");
        context.width = strip.naturalWidth;
        context.height = strip.naturalHeight;
        const cc = context.getContext("2d")!;
        cc.drawImage(strip, 0, 0);
        const data = cc.getImageData(0, 0, context.width, context.height);
        for (let y = 0; y < context.height; y++)
            for (let x = 0; x < context.width; x++) {
                const pos = record.direction === "east" ? x : record.direction === "west" ? record.overlap - 1 - x : record.direction === "south" ? y : record.overlap - 1 - y;
                data.data[(y * context.width + x) * 4 + 3] = Math.round(255 * blendWeight(pos, record.overlap));
            }
        cc.putImageData(data, 0, 0);
    }
    return { direction: record?.direction, image, masks, overhead, red: overlay(masks, "collision", [255, 45, 45, 100]), blue: overlay(masks, "overhead", [40, 140, 255, 105]), context, record };
}
function World({ tiles, seam, zoom, overview, collision, overhead, inspect, reset, loading, ensure }: {
    tiles: Tile[];
    seam: Seam;
    zoom: number;
    overview: boolean;
    collision: boolean;
    overhead: boolean;
    inspect?: Direction;
    reset: number;
    loading: string;
    ensure: (direction: Direction) => void;
}) {
    const surface = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), keys = useMovement(surface);
    const current = useRef({ tiles, seam, zoom, overview, collision, overhead, inspect, ensure });
    useEffect(() => { current.current = { tiles, seam, zoom, overview, collision, overhead, inspect, ensure }; }, [tiles, seam, zoom, overview, collision, overhead, inspect, ensure]);
    const teleport = useRef<((x: number, y: number) => void) | undefined>(undefined), view = useRef({ x: 0, y: 0, scale: 1 });
    const [diagnostics, setDiagnostics] = useState("Loading source…"), [placing, setPlacing] = useState(false);
    const center = tiles.find(t => t.direction === undefined);
    useEffect(() => {
        if (!center || !canvas.current)
            return;
        const ctx = canvas.current.getContext("2d")!;
        const { width, height } = center.masks, spawn = safeSpawn(center.masks);
        if (!spawn)
            return;
        const motion = createMovement({ x: spawn.x / 16, y: spawn.y / 16, z: 0 }), advance = createMovementClock();
        let frame = 0, previous = performance.now(), sample = 0;
        teleport.current = (x, y) => { if (worldWalkable(current.current.tiles, width, height, x, y)) {
            motion.x = x / 16;
            motion.y = y / 16;
            motion.vx = 0;
            motion.vy = 0;
        } };
        function draw(now: number) {
            if (!canvas.current || !surface.current)
                return;
            const { tiles, seam, zoom, overview, collision, overhead, inspect, ensure } = current.current;
            const dt = (now - previous) / 1000;
            previous = now;
            advance(dt, () => stepMovement(motion, movementFromKeys(keys.current), { ...DEFAULT_MOVEMENT, cornerTolerance: 0 }, p => worldWalkable(tiles, width, height, p.x * 16, p.y * 16) ? 0 : null));
            const x = motion.x * 16, y = motion.y * 16;
            for (const direction of approachingEdges(x, y, width, height))
                ensure(direction);
            const rect = surface.current.getBoundingClientRect(), cw = Math.max(1, Math.round(rect.width)), ch = Math.max(1, Math.round(rect.height));
            if (canvas.current.width !== cw || canvas.current.height !== ch) {
                canvas.current.width = cw;
                canvas.current.height = ch;
            }
            const scale = overview ? Math.min(cw / (width * 3), ch / (height * 3)) : zoom * Math.min(cw / width, ch / height);
            let camera = { x, y };
            if (overview)
                camera = { x: width / 2, y: height / 2 };
            else if (inspect !== undefined)
                camera = inspect === "east" ? { x: width, y: height * .72 } : inspect === "west" ? { x: 0, y: height * .72 } : inspect === "north" ? { x: width / 2, y: 0 } : { x: width * .365, y: height };
            view.current = { x: camera.x - cw / scale / 2, y: camera.y - ch / scale / 2, scale };
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = "#10151b";
            ctx.fillRect(0, 0, cw, ch);
            ctx.imageSmoothingEnabled = false;
            ctx.setTransform(scale, 0, 0, scale, -view.current.x * scale, -view.current.y * scale);
            const origins = [...tiles].sort((a, b) => DIRECTIONS.indexOf(a.direction!) - DIRECTIONS.indexOf(b.direction!)).map(tile => ({ tile, ...tileOrigin(tile.direction, width, height) }));
            for (const t of origins)
                ctx.drawImage(t.tile.image, t.x, t.y);
            if (seam === "blend")
                for (const { tile } of origins)
                    if (tile.context && tile.direction !== undefined) {
                        const d = tile.direction, ox = d === "east" ? width - OVERLAP : 0, oy = d === "south" ? height - OVERLAP : 0;
                        ctx.drawImage(tile.context, ox, oy);
                    }
            const avatar = () => { for (const mark of movementSprite(motion)) {
                ctx.fillStyle = `#${mark.color.toString(16).padStart(6, "0")}`;
                ctx.fillRect(Math.round(x) + mark.x, Math.round(y) + mark.y, mark.width, mark.height);
            } };
            avatar();
            for (const t of origins) {
                const left = Math.max(t.x, Math.floor(x) - 6), top = Math.max(t.y, Math.floor(y) - 26), right = Math.min(t.x + width, Math.ceil(x) + 6), bottom = Math.min(t.y + height, Math.ceil(y) + 4);
                if (right > left && bottom > top)
                    ctx.drawImage(t.tile.overhead, left - t.x, top - t.y, right - left, bottom - top, left, top, right - left, bottom - top);
            }
            const hidden = worldOccluded(tiles, width, height, x, y);
            if (hidden) {
                ctx.globalAlpha = .4;
                avatar();
                ctx.globalAlpha = 1;
            }
            for (const t of origins) {
                if (collision)
                    ctx.drawImage(t.tile.red, t.x, t.y);
                if (overhead)
                    ctx.drawImage(t.tile.blue, t.x, t.y);
            }
            surface.current.dataset.playerX = String(x);
            surface.current.dataset.playerY = String(y);
            surface.current.dataset.occluded = String(hidden);
            surface.current.dataset.ready = "true";
            surface.current.dataset.chunks = String(tiles.length - 1);
            sample += dt;
            if (sample > .2) {
                setDiagnostics(`Feet (${x.toFixed(1)}, ${y.toFixed(1)}) · ${hidden ? "behind overhead · silhouette 40%" : "visible"} · ${tiles.length - 1}/4 neighbours`);
                sample = 0;
            }
            frame = requestAnimationFrame(draw);
        }
        frame = requestAnimationFrame(draw);
        return () => { cancelAnimationFrame(frame); teleport.current = undefined; };
    }, [center, reset, keys]);
    return <div className={styles.scene}>
    <div className={styles.surface} ref={surface} role="application" aria-label="Expanding world movement" tabIndex={0} onPointerDown={e => { e.currentTarget.focus(); if (!placing || !canvas.current)
        return; const rect = canvas.current.getBoundingClientRect(); teleport.current?.(view.current.x + (e.clientX - rect.left) / view.current.scale, view.current.y + (e.clientY - rect.top) / view.current.scale); }}>
      <canvas ref={canvas} aria-label="Chunk world with source pixels, player and masks"/>
      {loading !== "" && <div role="status" className={styles.status}>{loading}</div>}
    </div>
    <output className={styles.note} aria-label="Movement diagnostics">{diagnostics}</output>
    <div className={styles.pad}>{[["←", "ArrowLeft"], ["↑", "ArrowUp"], ["↓", "ArrowDown"], ["→", "ArrowRight"]].map(([label, code]) => <button key={code} aria-label={`Move ${code!.slice(5).toLowerCase()}`} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); keys.current.add(code!); }} onPointerUp={() => keys.current.delete(code!)} onPointerCancel={() => keys.current.delete(code!)} onLostPointerCapture={() => keys.current.delete(code!)}>{label}</button>)}</div>
    <label className={styles.note}><input type="checkbox" checked={placing} onChange={e => setPlacing(e.target.checked)}/> Place player on a walkable point for inspection</label>
  </div>;
}
export default function Experiment() {
    const [tiles, setTiles] = useState<Tile[]>([]), [seam, setSeam] = useState<Seam>("blend"), [zoom, setZoom] = useState(1), [overview, setOverview] = useState(false), [collision, setCollision] = useState(false), [overhead, setOverhead] = useState(false), [inspect, setInspect] = useState<Direction>(), [reset, setReset] = useState(0);
    const [mode, setMode] = useState("saved"), [model, setModel] = useState<string>(MAP_MODELS[0].id), [maskModel, setMaskModel] = useState<string>(VISION_MODELS[0].id), [access, setAccess] = useState(false), [error, setError] = useState(""), [storage, setStorage] = useState("Chunks are saved in this browser."), [spent, setSpent] = useState(0);
    const [states, setStates] = useState<Partial<Record<Direction, string>>>({});
    const locks = useRef(new Set<Direction>()), revision = useRef(0), mounted = useRef(true), source = useRef("");
    useEffect(() => {
        mounted.current = true;
        const generation = revision;
        void Promise.all([loadImage(SOURCES[0].url), fetch("/g3b-map/cabin-vision.json").then(r => r.json() as Promise<MaskResult>)]).then(async ([image, masks]) => {
            const canvas = document.createElement("canvas");
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            canvas.getContext("2d")!.drawImage(image, 0, 0);
            source.current = canvas.toDataURL("image/png");
            const center = await makeTile(SOURCES[0].url, masks);
            if (mounted.current)
                setTiles([center]);
        }).catch(e => { if (mounted.current)
            setError(String(e)); });
        void fetch("/api/lab/m1-outpaint").then(r => { if (mounted.current)
            setAccess(r.ok); }).catch(() => { });
        return () => { mounted.current = false; generation.current++; };
    }, []);
    async function ensure(direction: Direction, manual = false) {
        if (locks.current.has(direction) || tiles.some(t => t.direction === direction) || (!manual && states[direction]?.startsWith("Failed")) || source.current === "")
            return;
        locks.current.add(direction);
        const version = revision.current;
        setStates(p => ({ ...p, [direction]: mode === "live" ? "Generating picture and masks…" : "Loading saved chunk…" }));
        setError("");
        try {
            const key = mode==="saved" ? `cabin-it2-saved-pro-flash-v3:${direction}` : `cabin-it2-live-v3:${model}:${maskModel}:${direction}`;
            let record: ChunkRecord | undefined;
            try {
                record = await savedChunk(key);
            }
            catch {
                if (mounted.current)
                    setStorage("Browser storage unavailable; export chunks to keep them.");
            }
            const restored = Boolean(record);
            let cost = 0;
            if (!record) {
                const response = await fetch(mode === "live" ? "/api/lab/m1-outpaint" : `/m1-outpaint/${direction}.json`, mode === "live" ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: source.current, direction, model, maskModel }), signal: AbortSignal.timeout(260000) } : undefined);
                const data = await response.json();
                if (!response.ok)
                    throw new Error(data.error ?? "Chunk unavailable.");
                record = mode === "live" ? data.chunk : data;
                cost = mode === "live" ? data.requestCostUsd : 0;
            }
            if (version !== revision.current || !mounted.current)
                return;
            if (!record || record.version !== 1 || record.direction !== direction || record.width !== 1376 || record.height !== 768 || record.overlap !== OVERLAP)
                throw new Error("Chunk does not match this world.");
            const tile = await makeTile(record.image, record.masks, record);
            if (version !== revision.current || !mounted.current)
                return;
            setTiles(previous => [...previous.filter(t => t.direction !== direction), tile]);
            setSpent(s => s + cost);
            setStates(p => ({ ...p, [direction]: restored ? "Restored from browser" : "Ready" }));
            try {
                await storeChunk(key, record);
            }
            catch {
                if (mounted.current)
                    setStorage("Browser storage full or unavailable; export chunks to keep them.");
            }
        }
        catch (e) {
            if (version === revision.current && mounted.current) {
                const message = e instanceof Error ? e.message : "Chunk failed.";
                setStates(p => ({ ...p, [direction]: `Failed: ${message}` }));
                setError(message);
            }
        }
        finally {
            if (version === revision.current)
                locks.current.delete(direction);
        }
    }
    function changeSettings(next: () => void) { revision.current++; locks.current.clear(); setTiles(p => p.filter(t => t.direction === undefined)); setStates({}); setError(""); setInspect(undefined); next(); }
    function download() { const records = tiles.flatMap(t => t.record !== undefined ? [t.record] : []), blob = new Blob([JSON.stringify({ version: 1, source: "cabin-it2", chunks: records }, null, 2)], { type: "application/json" }), url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = "evermore-cabin-chunks.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    const loading = DIRECTIONS.filter(d => states[d]?.startsWith("Loading") === true || states[d]?.startsWith("Generating") === true).map(d => `${d}: ${states[d] ?? "Loading…"}`).join(" · ");
    return <section className={styles.stage} aria-label="Expanding world and controls">
    <World tiles={tiles} seam={seam} zoom={zoom} overview={overview} collision={collision} overhead={overhead} inspect={inspect} reset={reset} loading={loading} ensure={direction => { void ensure(direction); }}/>
    <aside className={styles.controls}>
      <label>Seam method<select value={seam} onChange={e => setSeam(e.target.value as Seam)}><option value="pure">Pure outpainting</option><option value="blend">Overlap + blend (96 px)</option></select></label>
      <p className={styles.note}>Same generated pixels in both modes. Blend fades the model’s context strip into the parent; pure keeps the parent unchanged. Masks stay tied to their original chunk.</p>
      <label>Chunk source<select disabled={loading !== ""} value={mode} onChange={e => changeSettings(() => setMode(e.target.value))}><option value="saved">Saved model samples · no new cost</option><option value="live" disabled={!access}>Live local generation</option></select></label>
      <label>Image model<select disabled={mode !== "live" || loading !== ""} value={mode==="saved"?MAP_MODELS[2].id:model} onChange={e => changeSettings(() => setModel(e.target.value))}>{MAP_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
      <label>Mask model<select disabled={mode !== "live" || loading !== ""} value={mode==="saved"?VISION_MODELS[1].id:maskModel} onChange={e => changeSettings(() => setMaskModel(e.target.value))}>{VISION_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
      {mode === "live" && <p className={styles.note}>Approaching an edge spends the local generation budget. Image + Vision masks per chunk; hourly estimated reservation ≤ $3 / 8 calls.</p>}
      <label><input type="checkbox" checked={overview} onChange={e => setOverview(e.target.checked)}/> World overview</label>
      <label>Zoom · {zoom}×<input type="range" min="0.5" max="6" step="0.5" value={zoom} onChange={e => setZoom(Number(e.target.value))}/></label>
      <label><input type="checkbox" checked={collision} onChange={e => setCollision(e.target.checked)}/> Collision mask</label>
      <label><input type="checkbox" checked={overhead} onChange={e => setOverhead(e.target.checked)}/> Overhead layer</label>
      <button onClick={() => { setReset(v => v + 1); setInspect(undefined); setOverview(false); }}>Reset player</button>
      <button onClick={() => { setInspect(undefined); setOverview(false); }}>Follow player</button>
      <output>Successful requests this visit: ~${spent.toFixed(5)}</output>
      <p className={styles.note}>{storage} This slice extends one full picture in each cardinal direction. Corners and further rings remain closed. Vision masks are model drafts and can miss objects.</p>
      {DIRECTIONS.map(d => { const record = tiles.find(t => t.direction === d)?.record; return <div className={styles.chunk} key={d}><strong>{d.toUpperCase()}</strong><p role="status">{states[d] ?? "Loads when you approach"}</p>{record && <p>~${record.estimatedCostUsd.toFixed(5)} · {(record.durationMs / 1000).toFixed(1)}s<br />Image ${record.imageCostUsd.toFixed(5)} + masks ${record.maskCostUsd.toFixed(5)}<br />{record.model} / {record.masks.model}</p>}<nav><button disabled={states[d]?.startsWith("Loading") === true || states[d]?.startsWith("Generating") === true || Boolean(record) || tiles.length === 0} onClick={() => void ensure(d, true)}>Load {d}</button><button disabled={!record} onClick={() => { setInspect(d); setOverview(false); setZoom(4); }}>Inspect {d} seam</button></nav></div>; })}
      <button disabled={tiles.length < 2} onClick={download}>Export chunks</button>
      {error !== "" && <p role="alert" className={styles.error}>{error}</p>}
    </aside>
  </section>;
}
