export type DebugSnapshot = {
  fps: number;
  position: { x: number; y: number; z: number };
  seed: string | number;
};

/** Renderers can publish snapshots at a low rate instead of rerendering every frame. */
export function DebugOverlay({ fps, position, seed }: DebugSnapshot) {
  return (
    <dl aria-label="Experiment diagnostics" className="pointer-events-none absolute left-3 top-3 rounded bg-black/80 px-3 py-2 font-mono text-xs text-white">
      <div><dt className="inline">FPS: </dt><dd className="inline">{fps.toFixed(0)}</dd></div>
      <div><dt className="inline">Position: </dt><dd className="inline">x {position.x.toFixed(2)} / y {position.y.toFixed(2)} / z {position.z.toFixed(2)}</dd></div>
      <div><dt className="inline">Seed: </dt><dd className="inline">{seed}</dd></div>
    </dl>
  );
}
