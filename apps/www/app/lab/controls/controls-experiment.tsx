"use client";

import { RenderStats, useRenderStats } from "../../../components/lab/render-stats";

import { ControlGroup, LabViewport } from "../../../components/lab/lab-viewport";

import { DEFAULT_MOVEMENT, createMovement, createMovementClock, stepMovement } from "@evermore/core";
import { MovementSettings } from "../../../components/lab/movement-settings";
import { movementSprite } from "../../../components/lab/movement-sprite";

import { useEffect, useRef, useState } from "react";

import { DebugOverlay, type DebugSnapshot } from "../../../components/lab/debug-overlay";
import { movementFromKeys } from "../../../components/lab/keyboard";
import { useMovement } from "../../../components/lab/use-movement";

export default function ControlsExperiment() {
  const { stats: performanceStats, recordFrame } = useRenderStats();
  const canvas = useRef<HTMLCanvasElement>(null);
  const keys = useMovement(canvas);
  const [movement, setMovement] = useState({ ...DEFAULT_MOVEMENT });
  const [seed, setSeed] = useState("lab-1");
  const [copyStatus, setCopyStatus] = useState("");
  const [snapshot, setSnapshot] = useState<DebugSnapshot>({ fps: 0, position: { x: 10, y: 6, z: 0 }, seed });

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    const position = createMovement({ x: 10, y: 6, z: 0 });
    const advance = createMovementClock();
    const obstacles = [{ x: 5, y: 3, w: 1, h: 6 }, { x: 13, y: 3, w: 3, h: 1 }];
    const collision = (p: { x: number; y: number }) => {
      if (p.x < 0.25 || p.y < 0.25 || p.x > 19.75 || p.y > 11.75) return null;
      if (obstacles.some((o) => p.x + 0.25 > o.x && p.x - 0.25 < o.x + o.w && p.y + 0.25 > o.y && p.y - 0.25 < o.y + o.h)) return null;
      return 0;
    };
    let previous = 0;
    let sampleStart = 0;
    let frames = 0;
    let frame = 0;
    const tick = (now: number) => {
      const started = performance.now();
      const delta = previous > 0 ? Math.min((now - previous) / 1000, 0.05) : 0;
      previous = now;
      const direction = movementFromKeys(keys.current);
      advance(delta, () => stepMovement(position, direction, movement, collision));
      context.fillStyle = "#172b26";
      context.fillRect(0, 0, 640, 384);
      context.strokeStyle = "#294239";
      for (let x = 0; x <= 640; x += 32) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 384); context.stroke(); }
      for (let y = 0; y <= 384; y += 32) { context.beginPath(); context.moveTo(0, y); context.lineTo(640, y); context.stroke(); }
      context.fillStyle = "#657b69";
      for (const o of obstacles) context.fillRect(o.x * 32, o.y * 32, o.w * 32, o.h * 32);
      for (const mark of movementSprite(position)) {
        context.fillStyle = "#" + mark.color.toString(16).padStart(6, "0");
        context.fillRect(Math.round(position.x * 32) + mark.x, Math.round(position.y * 32) + mark.y, mark.width, mark.height);
      }
      recordFrame(performance.now() - started);
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
  }, [keys, seed, movement, recordFrame]);

  const settings = JSON.stringify({ seed, movement }, null, 2);
  return (
    <LabViewport title="Controls & diagnostics" description="Move the small character with WASD or the arrow keys after clicking the scene. Change speed, acceleration and corner handling to compare how movement feels. The plain background helps you focus on controls; the position and performance readings show what changes." controls={<>
      <ControlGroup title="Settings">
        <MovementSettings value={movement} onChange={setMovement} />
        <label className="flex flex-wrap items-center gap-3">Seed
          <input className="rounded border border-dusk bg-black/30 px-2 py-1" value={seed} onChange={(event) => setSeed(event.target.value)} />
        </label>
        <p className="text-sm text-mist">Changing settings resets the player. Seed is diagnostic metadata. Try diagonal movement along the walls and nudging past their corners.</p>
        <label className="grid gap-2">Settings JSON
          <textarea readOnly value={settings} rows={9} className="rounded bg-black/30 p-3 font-mono text-sm" />
        </label>
        <button type="button" className="justify-self-start rounded border border-gold px-3 py-2" onClick={() => {
          if (typeof navigator.clipboard === "undefined") { setCopyStatus("Select and copy the JSON above."); return; }
          void navigator.clipboard.writeText(settings).then(() => setCopyStatus("Copied settings."), () => setCopyStatus("Select and copy the JSON above."));
        }}>Copy settings</button>
        <p role="status" className="text-sm text-mist">{copyStatus}</p>
      </ControlGroup>
    </>}>
      <div className="relative h-full">
        <canvas ref={canvas} width={640} height={384} tabIndex={0}
          aria-label="Movement sandbox. Use WASD or arrow keys to move."
          className="h-full w-full focus:outline-2 focus:outline-gold"
          style={{ imageRendering: "pixelated" }}>
          Your browser needs canvas support to run this experiment.
        </canvas>
        <DebugOverlay {...snapshot} />
        <RenderStats stats={performanceStats} />
      </div>
    </LabViewport>
  );
}
