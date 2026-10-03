"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Object3D } from "three";
import { objectLibrary } from "../../../lib/objects";
import { normalizeObject, validateGlb, voxelize } from "./model";
import Viewer, { disposeObject } from "./viewer";
import styles from "./style.module.css";

const inputs = objectLibrary.filter(o => ["house", "tree", "well", "lantern"].includes(o.id));
export default function Experiment() {
  const [id, setId] = useState("house");
  const [resolution, setResolution] = useState(16);
  const [widthTiles, setWidthTiles] = useState(3);
  const [angle, setAngle] = useState(0);
  const [spin, setSpin] = useState(false);
  const [loaded, setLoaded] = useState<{ object: Object3D; name: string }>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const input = inputs.find(o => o.id === id)!;
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => () => { if (loaded) disposeObject(loaded.object); }, [loaded]);
  const result = useMemo(() => {
    if (!loaded) return { preview: undefined, error: "" };
    try {
      const object = loaded.object.clone(true);
      normalizeObject(object, widthTiles, resolution);
      const shell = voxelize(object, resolution, widthTiles);
      return { preview: { object, shell }, error: "" };
    } catch (error) { return { preview: undefined, error: error instanceof Error ? error.message : "Could not voxelize mesh." }; }
  }, [loaded, resolution, widthTiles]);
  const preview = result.preview;
  const select = (next: string) => {
    generation.current++; setBusy(false); setId(next); setLoaded(undefined); setMessage("");
  };
  const load = async (file: File | undefined) => {
    if (!file) return;
    const token = ++generation.current;
    setBusy(true); setMessage(""); setLoaded(undefined);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Use a GLB under 10 MB.");
      const data = await file.arrayBuffer(); validateGlb(data);
      const gltf = await new GLTFLoader().parseAsync(data, "");
      if (token !== generation.current) { disposeObject(gltf.scene); return; }
      setLoaded({ object: gltf.scene, name: file.name });
    } catch (error) { if (token === generation.current) setMessage(error instanceof Error ? error.message : "Could not load GLB."); }
    finally { if (token === generation.current) setBusy(false); }
  };
  const settings = { object: id, resolution, widthTiles, angle, spin };
  const download = () => {
    if (!preview) return;
    const blob = new Blob([JSON.stringify({ schema: "evermore-object-shell-v1", provenance: { sprite: input.sprite, mesh: loaded?.name, method: "local imported GLB; reconstruction origin unverified" }, ...preview.shell, collision: null })], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${id}-${resolution}-shell.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className={styles.workspace} aria-label="Offline object comparison">
    <aside className={styles.controls}>
      <label>Original object<select value={id} onChange={e => select(e.target.value)}>{inputs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
      <label>Load its exported mesh<input key={id} type="file" accept=".glb" disabled={busy} onChange={e => { void load(e.target.files?.[0]); e.target.value = ""; }} /></label>
      <p className="text-xs"><a className="underline" href={`/objects-3d/inputs/${id}.png`} download>Download RGB input</a> · <a className="underline" href={`/objects-3d/inputs/${id}-mask.png`} download>Download mask</a></p>
      <p className="text-xs">Local files only · static GLB · embedded textures · ≤10 MB. Files stay in this browser session.</p>
      <label>Voxels per tile<select value={resolution} onChange={e => setResolution(Number(e.target.value))}>{[16, 24, 32].map(n => <option key={n}>{n}</option>)}</select></label>
      <label>Horizontal extent: {widthTiles} tiles<input type="range" min="1" max="6" step="1" value={widthTiles} onChange={e => setWidthTiles(Number(e.target.value))} /></label>
      <label>View rotation: {angle}°<input type="range" min="0" max="360" value={angle} onChange={e => setAngle(Number(e.target.value))} /></label>
      <label className={styles.check}><input type="checkbox" checked={spin} onChange={e => setSpin(e.target.checked)} />Turntable</label>
      <button disabled={!preview} onClick={download}>Download voxel shell</button>
      <button onClick={() => { void navigator.clipboard.writeText(JSON.stringify(settings)).then(() => setMessage("Settings copied."), () => setMessage("Clipboard unavailable; copy the JSON below.")); }}>Copy settings</button>
      <details><summary>Settings JSON</summary><pre className="text-xs">{JSON.stringify(settings, null, 2)}</pre></details>
      <p role="status">{busy ? "Reading mesh…" : (result.error !== "" ? result.error : message !== "" ? message : (loaded ? `Imported: ${loaded.name}` : "Awaiting a reconstruction export."))}</p>
      {preview && <p className="text-xs">{preview.shell.cells.length.toLocaleString()} surface cells · grid {preview.shell.size.join(" × ")} · {(preview.shell.size[2] / resolution).toFixed(2)} tiles high · {preview.shell.samples.toLocaleString()} surface samples</p>}
    </aside>
    <div className={styles.views}>
      <figure className={styles.original}><figcaption>Original · {input.name}</figcaption>{/* Local pixel asset with nearest-neighbor display. */}<Image unoptimized src={input.sprite} alt={input.name} width={input.width} height={input.height} /><p>Authored footprint {input.footprint.columns} × {input.footprint.rows} tiles, height {input.heightTiles} tiles. Preview scale is chosen separately.</p></figure>
      <figure><figcaption>3D mesh · {loaded ? "local import" : "not reconstructed"}</figcaption><div className={styles.surface}>{preview ? <Viewer object={preview.object} angle={angle} spin={spin} /> : <p>Load a SAM 3D mesh export to inspect its shape and back.</p>}</div></figure>
      <figure><figcaption>Voxel surface · {resolution} per tile</figcaption><div className={styles.surface}>{preview ? <Viewer shell={preview.shell} angle={angle} spin={spin} /> : <p>No voxel result yet. The grid samples the mesh, not the sprite.</p>}</div></figure>
    </div>
  </section>;
}
