"use client";

import { useEffect, useRef, useState } from "react";

import { DebugOverlay, type DebugSnapshot } from "../../../components/lab/debug-overlay";
import { movementFromKeys } from "../../../components/lab/keyboard";
import { useMovement } from "../../../components/lab/use-movement";

export default function ControlsExperiment() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const keys = useMovement(canvas);
  const [speed, setSpeed] = useState(4);
  const [seed, setSeed] = useState("lab-1");
  const [copyStatus, setCopyStatus] = useState("");
  const [snapshot, setSnapshot] = useState<DebugSnapshot>({ fps: 0, position: { x: 10, y: 6, z: 0 }, seed });

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    const position = { x: 10, y: 6, z: 0 };
    let previous = 0;
    let sampleStart = 0;
    let frames = 0;
    let frame = 0;
    const tick = (now: number) => {
      const delta = previous > 0 ? Math.min((now - previous) / 1000, 0.05) : 0;
      previous = now;
      const direction = movementFromKeys(keys.current);
      position.x = Math.max(0.5, Math.min(19.5, position.x + direction.x * delta * speed));
      position.y = Math.max(0.5, Math.min(11.5, position.y + direction.y * delta * speed));
      context.fillStyle = "#172b26";
      context.fillRect(0, 0, 640, 384);
      context.strokeStyle = "#294239";
      for (let x = 0; x <= 640; x += 32) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 384); context.stroke(); }
      for (let y = 0; y <= 384; y += 32) { context.beginPath(); context.moveTo(0, y); context.lineTo(640, y); context.stroke(); }
      context.fillStyle = "#f3d38a";
      context.fillRect(Math.round(position.x * 32) - 8, Math.round(position.y * 32) - 12, 16, 24);
      if (sampleStart === 0) sampleStart = now;
      frames++;
      if (now - sampleStart >= 250) {
        setSnapshot({ fps: frames * 1000 / (now - sampleStart), position: { ...position }, seed });
        sampleStart = now;
        frames = 0;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [keys, seed, speed]);

  const settings = JSON.stringify({ seed, speed }, null, 2);
  return (
    <div className="grid gap-5">
      <div className="relative">
        <canvas ref={canvas} width={640} height={384} tabIndex={0}
          aria-label="Movement sandbox. Use WASD or arrow keys to move."
          className="w-full rounded border border-dusk focus:outline-2 focus:outline-gold"
          style={{ imageRendering: "pixelated" }}>
          Your browser needs canvas support to run this experiment.
        </canvas>
        <DebugOverlay {...snapshot} />
      </div>
      <fieldset className="grid gap-4 rounded border border-dusk p-4">
        <legend className="px-2">Settings</legend>
        <label className="flex flex-wrap items-center gap-3">Speed ({speed} cells/s)
          <input type="range" min={1} max={10} step={1} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
        </label>
        <label className="flex flex-wrap items-center gap-3">Seed
          <input className="rounded border border-dusk bg-black/30 px-2 py-1" value={seed} onChange={(event) => setSeed(event.target.value)} />
        </label>
        <p className="text-sm text-mist">Changing settings resets the player. Seed is diagnostic metadata in this sandbox.</p>
        <label className="grid gap-2">Settings JSON
          <textarea readOnly value={settings} rows={4} className="rounded bg-black/30 p-3 font-mono text-sm" />
        </label>
        <button type="button" className="justify-self-start rounded border border-gold px-3 py-2" onClick={() => {
          if (typeof navigator.clipboard === "undefined") { setCopyStatus("Select and copy the JSON above."); return; }
          void navigator.clipboard.writeText(settings).then(() => setCopyStatus("Copied settings."), () => setCopyStatus("Select and copy the JSON above."));
        }}>Copy settings</button>
        <p role="status" className="text-sm text-mist">{copyStatus}</p>
      </fieldset>
    </div>
  );
}
