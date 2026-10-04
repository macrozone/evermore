"use client";

import { MEADOW_HOUSE_SEED, WORLD_EXAMPLES } from "@evermore/world";
import { useState } from "react";
import type { WorldHandoff } from "../../../lib/world-handoff";

export function GenerationPanel({ initialIndex, initialSeed, handoff, onGenerate }: {
  initialIndex: number;
  initialSeed: string | number;
  handoff: WorldHandoff | null;
  onGenerate: (index: number, seed: string | number) => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [seed, setSeed] = useState(initialSeed);
  const specification = index === -2 ? handoff?.specification : index >= 0 ? WORLD_EXAMPLES[index] : null;
  const fixture = index === -1;
  return (
    <fieldset className="grid min-w-0 gap-3 border border-dusk p-3">
      <legend>Generate world</legend>
      <label>Source world
        <select aria-label="Source world" className="w-full min-w-0 bg-ink" value={index} onChange={(event) => setIndex(Number(event.target.value))}>
          {handoff && <option value={-2}>{handoff.specification.name} (imported)</option>}
          <option value={-1}>Meadow house</option>
          {WORLD_EXAMPLES.map((example, i) => <option key={example.name} value={i}>{example.name}</option>)}
        </select>
      </label>
      <label>Seed
        <input aria-label="Generation seed" className="w-full min-w-0 rounded bg-black/30 p-2" maxLength={200} disabled={fixture} value={fixture ? MEADOW_HOUSE_SEED : seed} onChange={(event) => setSeed(event.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded border border-gold px-3 py-1" disabled={fixture} onClick={() => setSeed(crypto.getRandomValues(new Uint32Array(1))[0]!)}>Roll seed</button>
        <button type="button" className="rounded border border-gold px-3 py-1" onClick={() => onGenerate(index, fixture ? MEADOW_HOUSE_SEED : seed)}>Generate</button>
      </div>
      <p>{fixture ? "Meadow house is a fixed comparison fixture." : "Choose a source and seed, then Generate to apply both and return the player to spawn."}</p>
      {specification && <details>
        <summary>Source specification JSON</summary>
        <textarea aria-label="Source specification JSON" readOnly rows={10} value={JSON.stringify({ specification, seed }, null, 2)} className="mt-2 w-full min-w-0 rounded bg-black/30 p-2 font-mono text-xs" />
      </details>}
    </fieldset>
  );
}
