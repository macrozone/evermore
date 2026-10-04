"use client";
import { useState } from "react";
import Link from "next/link";
import { AssetPreview } from "./preview";
import { IMAGE_MODELS, TEXT_MODELS, type AssetBatch, type AssetInput, type AssetRole, type RoleInference } from "./generation";
import styles from "./styles.module.css";

const usd = (n: number) => `$${n.toFixed(5)}`;
const seconds = (n: number) => `${(n / 1000).toFixed(2)} s`;
export default function AssetGenerator() {
  const [description, setDescription] = useState("Mossy boulder with tiny ferns");
  const [seed, setSeed] = useState(42);
  const [imageModel, setImageModel] = useState<AssetInput["imageModel"]>(IMAGE_MODELS[0].id);
  const [textModel, setTextModel] = useState<AssetInput["textModel"]>(TEXT_MODELS[0]);
  const [strategy, setStrategy] = useState<AssetInput["strategy"]>("independent");
  const [inference, setInference] = useState<RoleInference>();
  const [override, setOverride] = useState<AssetRole>();
  const [batches, setBatches] = useState<AssetBatch[]>([]);
  const [activeIndex, setActiveIndex] = useState(0), [selected, setSelected] = useState(0);
  const [view, setView] = useState<"grid" | "scene" | "seam">("grid");
  const [guides, setGuides] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [rate, setRate] = useState<{ imageUsed: number; imageLimit: number; textUsed: number; textLimit: number }>();
  const active = batches[activeIndex];
  const parameters = override ?? inference?.parameters;
  function changeDescription(value: string) { setDescription(value); setInference(undefined); setOverride(undefined); }
  async function request(action: AssetInput["action"]) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/lab/asset-generator", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, description, seed, imageModel, textModel, strategy, ...(override ? { override } : {}) }) });
      const result = await response.json();
      if (result.rate !== undefined) setRate(result.rate);
      if (!response.ok) throw new Error(result.error ?? "Generation failed.");
      if (action === "infer") { setInference(result.inference); setOverride(undefined); }
      else {
        const batch = result as AssetBatch;
        setInference(batch.inference);
        // Keep up to six families for the scene without persisting large images in browser storage.
        setBatches(previous => [batch, ...previous].slice(0, 6)); setActiveIndex(0); setSelected(0);
        if (batch.errors.length > 0) setError(`${batch.errors.length} variants failed: ${batch.errors.map(e => `#${e.index + 1}: ${e.error}`).join(" ")}`);
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Generation failed."); }
    finally { setBusy(false); }
  }
  function selectFamily(index: number, list = batches) {
    const batch = list[index];
    if (!batch) return;
    setActiveIndex(index); setSelected(0); setDescription(batch.description); setSeed(batch.seed);
    setInference(batch.inference); setOverride(batch.overridden ? batch.parameters : undefined);
    setImageModel(batch.imageModel as AssetInput["imageModel"]); setTextModel(batch.inference.model as AssetInput["textModel"]); setStrategy(batch.strategy);
  }
  async function loadExamples() {
    setError(""); setBusy(true);
    try {
      const response = await fetch("/asset-generator/examples/index.json");
      if (!response.ok) throw new Error("Recorded examples are unavailable.");
      const examples = await response.json() as AssetBatch[];
      setBatches(examples.slice(0, 6)); selectFamily(0, examples);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not load examples."); }
    finally { setBusy(false); }
  }
  function edit<K extends keyof AssetRole>(key: K, value: AssetRole[K]) { if (parameters) setOverride({ ...parameters, [key]: value }); }
  return <main className={styles.page}>
    <header><Link href="/lab">← Lab</Link><span>Experiment · 2D asset families</span><h1>Describe an asset. Explore ten variations.</h1>
      <p>A text model derives how your asset belongs in the world: seamless ground, a freestanding object, or a repeating wall or fence. Review its dimensions and ground anchor, then compare the family in a grid and a small test scene. Any subject is welcome.</p>
      <p className={styles.note}>Generated pixel art follows Evermore’s warm, axis-aligned Art Bible. Ground edges are repaired across the family; raw images remain available. Live generation runs locally with Vertex credentials. A seed fixes the request and procedural variation; model outputs are not guaranteed reproducible after the cache is cleared.</p>
    </header>
    <div className={styles.workspace}>
      <aside className={styles.panel}>
        <fieldset disabled={busy}>
          <label>Description<textarea value={description} onChange={e => changeDescription(e.target.value)} maxLength={500} rows={3} /></label>
          <label>Seed<input type="number" min={0} max={2147483637} value={seed} onChange={e => setSeed(Number(e.target.value))} /></label>
          <button className={styles.primary} disabled={description.trim() === "" || !Number.isInteger(seed) || seed < 0 || seed > 2147483637} onClick={() => void request("generate")}>{busy ? "Generating…" : "10 variants"}</button>
          <details><summary>Models and variation method</summary>
            <label>Image model<select value={imageModel} onChange={e => setImageModel(e.target.value as AssetInput["imageModel"])}>{IMAGE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label} · ~{usd(m.imageUsd)} / image</option>)}</select></label>
            <label>Text model<select value={textModel} onChange={e => { setTextModel(e.target.value as AssetInput["textModel"]); setInference(undefined); setOverride(undefined); }}>{TEXT_MODELS.map(m => <option key={m}>{m}</option>)}</select></label>
            <label>Variation method<select value={strategy} onChange={e => setStrategy(e.target.value as AssetInput["strategy"])}><option value="independent">A · Ten model images</option><option value="reference">B · Base image + nine image-to-image variants</option><option value="procedural">C · One model image + nine procedural variants</option></select></label>
            <p className={styles.note}>A explores shapes independently. B holds the first image as a fixed reference. C uses seeded mirror and color shifts; it costs one image call and creates less structural variety.</p>
          </details>
          <button onClick={() => void request("infer")} disabled={description.trim() === ""}>Derive role only</button>
          {parameters && <section className={styles.parameters} aria-label="Technical parameters">
            <h2>{override ? "Overridden parameters" : "Model-derived parameters"}</h2><p>{inference?.parameters.explanation}</p>
            <label>Technical role<select value={parameters.role} onChange={e => edit("role", e.target.value as AssetRole["role"])}><option value="surface">Surface · opaque · repeat XY</option><option value="object">Object · transparent · ground anchor</option><option value="strip">Strip · transparent · repeat X</option></select></label>
            <div className={styles.pair}>{(["widthTiles", "heightTiles"] as const).map(key => <label key={key}>{key === "widthTiles" ? "Width (tiles)" : "Height (tiles)"}<input type="number" min={1} max={8} value={parameters[key]} onChange={e => edit(key, Number(e.target.value))} /></label>)}</div>
            <div className={styles.pair}>{(["anchorX", "anchorY"] as const).map(key => <label key={key}>Ground {key === "anchorX" ? "X" : "Y"}<input type="number" min={0} max={1} step={0.05} value={parameters[key]} onChange={e => edit(key, Number(e.target.value))} /></label>)}</div>
            {override && <button onClick={() => setOverride(undefined)}>Reset to model parameters</button>}
            {inference && <small>{inference.model} · {seconds(inference.durationMs)} · {usd(inference.estimatedCostUsd)} estimated</small>}
            <p className={styles.note}>Edits apply to the next batch. The preview uses the parameters saved with each generated family.</p>
          </section>}
        </fieldset>
        {rate && <p className={styles.note}>Hourly calls: images {rate.imageUsed}/{rate.imageLimit}, text {rate.textUsed}/{rate.textLimit}. Successful batches are cached in this server process.</p>}
        {error !== "" && <p className={styles.error} role="alert">{error}</p>}
      </aside>
      <section className={styles.results} aria-live="polite">
        <button disabled={busy} onClick={() => void loadExamples()}>Load recorded experiments (no calls)</button>
        <nav className={styles.tabs}>{(["grid", "scene", "seam"] as const).map(tab => <button key={tab} aria-pressed={view === tab} onClick={() => setView(tab)}>{tab === "grid" ? "Variant grid" : tab === "scene" ? "Test scene" : "Seam close-up"}</button>)}<label><input type="checkbox" checked={guides} onChange={e => setGuides(e.target.checked)} /> Guides</label></nav>
        {active ? <>
          <div className={styles.family}><label>Active family<select disabled={busy} value={activeIndex} onChange={e => selectFamily(Number(e.target.value))}>{batches.map((b, i) => <option key={i} value={i}>{b.description}</option>)}</select></label><span>{active.parameters.role} · {active.parameters.widthTiles} × {active.parameters.heightTiles} tiles · {active.variants.length}/10</span></div>
          <p className={styles.note}>{active.imageModel} · {active.strategy} · {seconds(active.durationMs)} batch · {usd(active.estimatedCostUsd)} {active.recordedAt !== undefined ? "recorded generation (estimated)" : active.cached ? "this request (cache hit)" : "this request (estimated, incl. role inference)"}</p>
          {view === "grid" ? <div className={styles.grid}>{active.variants.map((variant, i) => <article key={variant.index} className={i === selected ? styles.selected : ""}>
            <button className={styles.sprite} onClick={() => setSelected(i)} aria-label={`Select variant ${variant.index + 1}`}><span style={{ backgroundImage: `url(${variant.sprite})`, width: variant.width * 2, height: variant.height * 2 }} /></button>
            <strong>Variant {variant.index + 1} · seed {variant.seed}</strong><small>{seconds(variant.durationMs)} · {usd(variant.estimatedCostUsd)}</small><small>{variant.source === "procedural" ? "Procedural · shared base" : "Model image"}</small>
            <div><a href={variant.sprite} download={`asset-${variant.seed}.png`}>PNG</a> · <a href={variant.raw} download={`raw-${variant.seed}.${variant.raw.startsWith("data:image/jpeg") || /\.jpe?g$/i.test(variant.raw) ? "jpg" : variant.raw.startsWith("data:image/webp") || /\.webp$/i.test(variant.raw) ? "webp" : "png"}`}>Raw</a></div>
          </article>)}</div> : <AssetPreview batches={batches} active={active} selected={selected} mode={view} guides={guides} />}
          {view === "seam" && <><label>Start variant<select value={selected} onChange={e => setSelected(Number(e.target.value))}>{active.variants.map((v, i) => <option key={v.index} value={i}>Variant {v.index + 1}</option>)}</select></label><p className={styles.note}>{active.parameters.role === "object" ? "Objects do not tile; inspect the cutout and spacing here." : `Repaired family edge MAE: X ${active.variants[selected]?.seamError.horizontal.toFixed(2) ?? "—"}${active.parameters.role === "surface" ? ` · Y ${active.variants[selected]?.seamError.vertical.toFixed(2) ?? "—"}` : " (strip repeats X only)"}. Equal edges prevent hard joins; pattern repetition still needs visual judgement.`}</p></>}
          <p className={styles.note}>The scene combines the last six families in memory. Surface families occupy ground patches; objects use their saved ground anchors. Reloading clears this experiment.</p>
        </> : <div className={styles.empty}><h2>Your world starts with a description.</h2><p>Try cobblestones with grass in the joints, a crooked fishing hut, a mossy boulder, a flowering bush, or a weathered wooden fence.</p><p>Use “Derive role only” to inspect parameters before spending image calls, or generate ten variants directly.</p></div>}
        <p className={styles.note}>Cost estimates use <a href="https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing">Google’s global standard token prices</a> (checked October 4, 2026). They are not invoices. Procedural variants share the base image’s cost; FPS measures this canvas preview.</p>
      </section>
    </div>
  </main>;
}
