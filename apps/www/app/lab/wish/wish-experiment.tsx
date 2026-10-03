"use client";
import Link from "next/link";
import { useState } from "react";
import { consistency, decideWish, FORMULA, offlineScope, parseWishInput, parseWishScope, PRICING_URL, WISH_EXAMPLES, WISH_MODELS, type WishInput, type WishResult } from "./model";
import styles from "./wish.module.css";

const initial: WishInput = { wish: WISH_EXAMPLES[0]!.wish, place: "My cottage bedroom, beside my bed", influence: 1, inspiration: 100, model: WISH_MODELS[0], mode: "offline" };
const labels = ["Flash-Lite", "Flash", "Pro"];
const reasons = { "offline-mode": "Offline mode selected", disabled: "Live estimation is disabled on this server", credentials: "Server credentials unavailable", provider: "Selected model unavailable or timed out", "invalid-output": "Model output failed validation", limit: "Instance call limit reached; wait or use offline mode", "no-influence": "No influence here; no model was called" };
const unknown = (value: number | null) => value === null ? "unknown" : value.toLocaleString();

export default function WishExperiment() {
  const [input, setInput] = useState(initial);
  const [runs, setRuns] = useState<WishResult[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [completed, setCompleted] = useState(0);
  const scope = runs.at(-1)?.scope ?? offlineScope(input.wish);
  const decision = decideWish(scope, input.influence, input.inspiration);
  const stats = consistency(runs, input.influence);
  const update = (change: Partial<WishInput>) => {
    setInput(value => ({ ...value, ...change })); setError(""); setCopied(false);
    if (change.wish !== undefined || change.place !== undefined || change.model !== undefined || change.mode !== undefined) { setRuns([]); setCompleted(0); }
  };
  const valid = input.wish.trim().length > 0 && input.place.trim().length > 0;
  async function estimate(count: number) {
    setPending(true); setError(""); setCopied(false); setRuns([]); setCompleted(0);
    const batch: WishResult[] = [];
    try {
      const snapshot = parseWishInput(input);
      for (let i = 0; i < count; i++) {
        const response = await fetch("/api/lab/wish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot), signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error("The estimate request was rejected. Check your input and try again.");
        const result = await response.json() as WishResult;
        result.scope = parseWishScope(result.scope);
        batch.push(result); setRuns([...batch]); setCompleted(i + 1);
      }
    } catch { setError("Estimation failed. Completed calls remain below; no incomplete batch counts as consistency."); }
    finally { setPending(false); }
  }
  const exportData = JSON.stringify({ version: 1, input, formula: FORMULA, preview: runs.length > 0 ? null : { source: "offline", scope, decision }, runs: runs.map(run => ({ ...run, decision: decideWish(run.scope, input.influence, input.inspiration) })), consistency: stats, pricingUrl: PRICING_URL }, null, 2);
  async function copy() {
    try { await navigator.clipboard.writeText(exportData); setCopied(true); }
    catch { setError("Clipboard unavailable. Select and copy the JSON below."); }
  }
  return <main className={styles.studio}>
    <header className={styles.header}><Link href="/lab">← Lab</Link><span>Book of Evermore · Wish ledger</span><small>Scope experiment v1</small></header>
    <div className={styles.spread}>
      <section className={styles.controls} aria-label="Wish controls" data-testid="wish-controls">
        <h1>Before a wish comes true</h1>
        <p className={styles.intro}>Estimate the change before creating the world. Experimental costs, not game balance.</p>
        <fieldset disabled={pending}>
          <div className={styles.primary}><div className={styles.ranges}>
            <label>Influence <output>{input.influence.toFixed(2)}</output><input aria-label="Influence" type="range" min="0" max="1" step="0.01" value={input.influence} onChange={e => update({ influence: Number(e.target.value) })} /></label>
            <label>Inspiration <output>{input.inspiration}</output><input aria-label="Inspiration" type="range" min="0" max="5000" step="1" value={input.inspiration} onChange={e => update({ inspiration: Number(e.target.value) })} /></label>
          </div>
          <label className={styles.wish}>Your wish<textarea aria-label="Your wish" maxLength={2000} rows={2} value={input.wish} onChange={e => update({ wish: e.target.value })} /></label>
          <label>Place<input aria-label="Place" maxLength={300} value={input.place} onChange={e => update({ place: e.target.value })} /></label>
          <div className={styles.selects}>
            <label>Model<select aria-label="Model" value={input.model} onChange={e => update({ model: e.target.value as WishInput["model"] })}>{WISH_MODELS.map((model, i) => <option key={model} value={model}>{labels[i]} · {model}</option>)}</select></label>
            <label>Estimation<select aria-label="Estimation mode" value={input.mode} onChange={e => update({ mode: e.target.value as WishInput["mode"] })}><option value="offline">Offline fixtures</option><option value="live">Live model (server opt-in)</option></select></label>
          </div>
          <div className={styles.actions}><button disabled={!valid} onClick={() => { void estimate(1); }}>Estimate wish</button><button disabled={!valid} onClick={() => { void estimate(3); }}>Repeat ×3</button></div>
          <p className={styles.hint}>Live requires server opt-in. Up to 30 attempts per instance, 6/minute, one at a time. Nothing is generated or spent from your inspiration.</p>
          </div><h2>25 example wishes</h2>
          <div className={styles.examples}>{WISH_EXAMPLES.map((example, i) => <button key={example.wish} aria-pressed={input.wish === example.wish} onClick={() => update({ wish: example.wish })}><span>{String(i + 1).padStart(2, "0")}</span>{example.wish}</button>)}</div>
        </fieldset>
      </section>
      <section className={styles.result} aria-label="Wish result" data-testid="wish-result">
        <div className={styles.summary}>
          <p className={styles.source}>{runs.at(-1)?.source === "vertex" ? `Live model · ${input.model}` : "Offline fixture / placeholder · not a model estimate"}</p>
          <div className={styles.verdict}><strong data-testid="inspiration-cost">{decision.cost.toLocaleString()}</strong><span>inspiration<br/><b data-testid="wish-verdict">{decision.accepted ? "Within budget" : "Wish rejected"}</b></span></div>
          <p>{decision.rejection === "no-influence" ? "You have no influence here. Move to a place within your influence before wishing." : decision.rejection === "insufficient-inspiration" ? `You need ${(decision.cost - input.inspiration).toLocaleString()} more inspiration. Try a smaller wish or wait.` : `${(input.inspiration - decision.cost).toLocaleString()} inspiration would remain. This is only a preview.`}</p>
          <dl className={styles.metrics}><div><dt>Area</dt><dd>{scope.area.toLocaleString()} m²</dd></div><div><dt>3D cells</dt><dd>{scope.cells.toLocaleString()}</dd></div><div><dt>Structures</dt><dd>{scope.structures}</dd></div><div><dt>Complexity</dt><dd>{scope.complexity} / 5</dd></div></dl>
        </div>
        <div className={styles.details}>
          <p role="status">{pending ? `Estimating… ${completed} completed` : runs.length > 0 ? `${runs.length} call${runs.length > 1 ? "s" : ""} completed` : "Offline preview. Run an estimate to record a call."}</p>
          {error.length > 0 && <p role="alert">{error}</p>}
          {runs.at(-1)?.fallbackReason !== undefined && <p className={styles.notice}>{reasons[runs.at(-1)!.fallbackReason!]}. Offline data is shown.</p>}
          <h2>Assumptions</h2><p>{scope.reason}</p>
          <h2>Try a smaller wish</h2><p>{scope.smallerWish}</p><button disabled={pending} onClick={() => update({ wish: scope.smallerWish })}>Use smaller wish</button><p className={styles.hint}>A suggestion must be estimated again. It is not guaranteed to fit your budget.</p>
          <h2>Consistency · same wish and place</h2><p data-testid="consistency">{stats ? `${stats.min}–${stats.max} inspiration · relative spread ${(stats.relativeSpread * 100).toFixed(1)}% (range / mean, n=3)` : "Not measured. Requires three successful live estimates; offline data and partial batches do not count."}</p>
          {runs.map((run, i) => <article className={styles.call} key={i}><b>Call {i + 1} · {run.source} · {decideWish(run.scope, input.influence, input.inspiration).cost} inspiration</b><p>{run.durationMs} ms · input {unknown(run.usage.inputTokens)} / output {unknown(run.usage.outputTokens)} / thinking {unknown(run.usage.thinkingTokens)} tokens · estimated USD {run.estimatedUsd === null ? "unknown" : `$${run.estimatedUsd.toFixed(6)}`}</p>{run.fallbackReason !== undefined && <p>{reasons[run.fallbackReason]}</p>}<small>{run.pricingBasis}</small></article>)}
          <h2>Experimental formula v1</h2><code className={styles.formula}>{FORMULA}</code><p className={styles.hint}>A one-metre cell is an estimation assumption. Area counts the footprint; cells include vertical changes. Influence adjusts costs locally. No world generation or balance decision.</p>
          <a href={PRICING_URL} target="_blank" rel="noreferrer">Vertex pricing reference</a>
          <h2>Parameters & results</h2><button onClick={() => { void copy(); }}>{copied ? "Copied JSON" : "Copy JSON"}</button><textarea aria-label="Parameters and results JSON" className={styles.json} readOnly value={exportData} rows={10} />
        </div>
      </section>
    </div>
  </main>;
}
