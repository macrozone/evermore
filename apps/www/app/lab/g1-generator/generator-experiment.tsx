"use client";
import { generateWorld, getMaterial, WORLD_EXAMPLES, type World, type WorldSpecification } from "@evermore/world";
import { useEffect, useRef, useState } from "react";
import { useWorldHandoff } from "../../../components/lab/use-world-handoff";
import { parseWorldHandoff, saveWorldHandoff } from "../../../lib/world-handoff";

export default function GeneratorExperiment() {
  const { handoff, error: importError, ready } = useWorldHandoff();
  const [custom, setCustom] = useState<WorldSpecification | null>(null);
  const [example, setExample] = useState<number | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [validation, setValidation] = useState("");
  const [seedOverride, setSeed] = useState<string | number | null>(null);
  const seed = seedOverride ?? handoff?.seed ?? "evermore-g1";
  const [slice, setSlice] = useState(39);
  const [result, setResult] = useState<{ world: World; milliseconds: number }>();
  const [error, setError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const spec = example === null ? custom ?? handoff?.specification ?? WORLD_EXAMPLES[0]! : WORLD_EXAMPLES[example]!;
  const applyJSON = () => {
    try {
      const next = parseWorldHandoff(draft ?? JSON.stringify(spec), seed);
      setCustom(next.specification); setExample(null); setSeed(next.seed);
      setDraft(JSON.stringify(next.specification, null, 2));
      try { saveWorldHandoff(next, window.localStorage); setValidation("Valid specification applied."); }
      catch { setValidation("Valid specification applied. Browser storage is unavailable."); }
    } catch (cause) { setValidation(cause instanceof Error ? cause.message : "Invalid world specification."); }
  };
  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => {
    try {
      const start = performance.now();
      const world = generateWorld(spec, seed);
      setResult({ world, milliseconds: performance.now() - start });
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Generation failed"); }
    });
    return () => cancelAnimationFrame(frame);
  }, [spec, seed, ready]);
  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context || !result) return;
    const { world } = result;
    context.clearRect(0, 0, 512, 512);
    const cell = 512 / Math.max(world.width, world.depth);
    for (let y = 0; y < world.depth; y++) for (let x = 0; x < world.width; x++) {
      let z = Math.min(slice, world.height - 1);
      while (z > 0 && world.getCell(x, y, z) === 0) z--;
      context.fillStyle = "#" + getMaterial(world.getCell(x, y, z)).color.toString(16).padStart(6, "0");
      context.fillRect(x * cell, y * cell, cell, cell);
    }
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.strokeRect(world.spawn.x * cell, world.spawn.y * cell, cell, cell);
  }, [result, slice]);
  return <div className="grid gap-5">
    <fieldset className="flex flex-wrap gap-5 rounded border border-dusk p-4">
      <legend>Generation settings</legend>
      <label>Example <select className="bg-black p-2" value={example === null && (custom || handoff) ? "custom" : example ?? 0} onChange={e => { setDraft(null); setValidation(""); setExample(e.target.value === "custom" ? null : Number(e.target.value)); }}>
        {(custom || handoff) && <option value="custom">Imported specification</option>}
        {WORLD_EXAMPLES.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}
      </select></label>
      <label>Seed <input className="bg-black p-2" value={seed} onChange={e => setSeed(e.target.value)} /></label>
      <label>Highest visible layer ({slice}) <input type="range" min={0} max={spec.size.height - 1} value={Math.min(slice, spec.size.height - 1)} onChange={e => setSlice(Number(e.target.value))} /></label>
    </fieldset>
    <p role="status">{importError}</p>
    <p role="status">{error !== "" ? error : (result ? `${result.milliseconds.toFixed(1)} ms · ${result.world.structures.length} structures · spawn ${result.world.spawn.x}/${result.world.spawn.y}/${result.world.spawn.z}` : "Generating…")}</p>
    <canvas ref={canvas} width={512} height={512} aria-label={`Top-down generated world: ${spec.name}. White outline marks the player start.`} className="w-full max-w-xl border border-dusk" style={{ imageRendering: "pixelated" }} />
    <p className="text-mist">{spec.mood} · {spec.climate} · {spec.timeOfDay}. This diagnostic map uses material colours; mood, palette and daylight are metadata for future renderer integration.</p>
    <label className="grid gap-2">World specification JSON<textarea rows={14} value={draft ?? JSON.stringify(spec, null, 2)} onChange={event => { setDraft(event.target.value); setValidation(""); }} className="w-full bg-black/30 p-3 font-mono text-sm" /></label>
    <button type="button" onClick={applyJSON} className="rounded border border-gold p-2">Validate and apply JSON</button>
    <p role="status">{validation}</p>
  </div>;
}
