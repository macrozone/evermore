"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./render-stats.module.css";

export type RenderSnapshot = { fps: number; frameMs: number; triangles?: number; calls?: number };

/** Count rendered frames, including on-demand frames; never run an extra render loop. */
export function useRenderStats() {
  const sample = useRef({ frames: 0, milliseconds: 0, triangles: undefined as number | undefined, calls: undefined as number | undefined });
  const [stats, setStats] = useState<RenderSnapshot>({ fps: 0, frameMs: 0 });
  const recordFrame = useCallback((milliseconds: number, geometry?: { triangles: number; calls: number }) => {
    sample.current.frames++;
    sample.current.milliseconds += milliseconds;
    sample.current.triangles = geometry?.triangles;
    sample.current.calls = geometry?.calls;
  }, []);
  useEffect(() => {
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const value = sample.current;
      setStats({ fps: value.frames * 1000 / (now - previous), frameMs: value.frames > 0 ? value.milliseconds / value.frames : 0, triangles: value.triangles, calls: value.calls });
      value.frames = 0;
      value.milliseconds = 0;
      previous = now;
    }, 500);
    return () => window.clearInterval(timer);
  }, []);
  return { stats, recordFrame };
}

export function RenderStats({ stats }: { stats: RenderSnapshot }) {
  return <div aria-label="Renderer performance" className={styles.stats}>
    <div>FPS: {stats.fps.toFixed(0)} · Frame time (CPU): {stats.frameMs.toFixed(1)} ms</div>
    {stats.triangles !== undefined && <div>Triangles: {stats.triangles.toLocaleString()} · Draw calls: {stats.calls?.toLocaleString()}</div>}
  </div>;
}
