export type DebugSnapshot = {
  fps: number;
  position: { x: number; y: number; z: number };
  seed: string | number;
  velocity?: { x: number; y: number };
  frameTimes?: number[];
};

/** Renderers can publish snapshots at a low rate instead of rerendering every frame. */
export function DebugOverlay({ fps, position, seed, velocity, frameTimes }: DebugSnapshot) {
  return (
    <dl aria-label="Experiment diagnostics" className="pointer-events-none absolute left-3 top-3 rounded bg-night/90 px-3 py-2 font-mono text-xs text-snow">
      <div><dt className="inline">FPS: </dt><dd className="inline">{fps.toFixed(0)}</dd></div>
      <div><dt className="inline">Position: </dt><dd className="inline">x {position.x.toFixed(2)} / y {position.y.toFixed(2)} / z {position.z.toFixed(2)}</dd></div>
      {velocity && <div><dt className="inline">Velocity: </dt><dd className="inline">x {velocity.x.toFixed(2)} / y {velocity.y.toFixed(2)} cells/s</dd></div>}
      <div><dt className="inline">Frame: </dt><dd className="inline">{(fps > 0 ? 1000 / fps : 0).toFixed(1)} ms</dd></div>
      {frameTimes && <div>
        <dt>Frame time (0–50 ms, last 120 frames)</dt>
        <dd><svg aria-label="Frame-time graph" viewBox="0 0 240 50" className="mt-1 h-12 w-full" preserveAspectRatio="none">
          <path d="M0 33.33 H240" stroke="#aaa" strokeDasharray="4 4" />
          <polyline points={frameTimes.map((ms, i) => `${i * 2},${50 - Math.min(ms, 50)}`).join(" ")} fill="none" stroke="#e8c87a" strokeWidth="1" />
        </svg></dd>
      </div>}
      <div><dt className="inline">Seed: </dt><dd className="inline">{seed}</dd></div>
    </dl>
  );
}
