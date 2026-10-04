"use client";
import { useEffect, useRef, useState } from "react";
import type { AssetBatch } from "./generation";

export function AssetPreview({ batches, active, selected, mode, guides }: { batches: AssetBatch[]; active?: AssetBatch; selected: number; mode: "scene" | "seam"; guides: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [fps, setFps] = useState(0);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let cancelled = false, frame = 0;
    const load = (url: string) => new Promise<HTMLImageElement | null>(resolve => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = () => resolve(null); image.src = url;
    });
    const groups = mode === "seam" ? active ? [active] : [] : batches;
    void Promise.all(groups.map(async batch => ({ batch, images: await Promise.all(batch.variants.map(v => load(v.sprite))) }))).then(groups => {
      if (cancelled) return;
      const surfaces = groups.filter(g => g.batch.parameters.role === "surface" && g.images.length > 0);
      const objects = groups.filter(g => g.batch.parameters.role !== "surface" && g.images.length > 0);
      let frames = 0, last = performance.now();
      const draw = () => {
        if (cancelled) return;
        context.imageSmoothingEnabled = false;
        context.fillStyle = "#718462"; context.fillRect(0, 0, canvas.width, canvas.height);
        if (mode === "seam" && active && (groups[0]?.images.length ?? 0) > 0) {
          const g = groups[0]!, v = active.variants[Math.min(selected, active.variants.length - 1)]!;
          const scale = Math.max(2, Math.floor(Math.min(canvas.width / (v.width * 3), canvas.height / (v.height * 3))));
          const tw = v.width * scale, th = v.height * scale, left = Math.floor((canvas.width - tw * 3) / 2), top = Math.floor((canvas.height - th * 3) / 2);
          context.fillStyle = "#353c39"; context.fillRect(0, 0, canvas.width, canvas.height);
          for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
            const image = g.images[(selected + x + y * 3) % g.images.length];
            if (image) context.drawImage(image, left + x * tw, top + y * th, tw, th);
          }
          if (guides) {
            context.strokeStyle = "#ffc77b"; context.lineWidth = 1; context.setLineDash([4, 4]);
            for (let i = 1; i < 3; i++) { context.beginPath(); context.moveTo(left + i * tw, top); context.lineTo(left + i * tw, top + th * 3); context.stroke(); context.beginPath(); context.moveTo(left, top + i * th); context.lineTo(left + tw * 3, top + i * th); context.stroke(); }
            context.setLineDash([]);
          }
        } else {
          // Default ground remains simple; generated ground families tile in two contiguous patches.
          for (let y = 0; y < 28; y++) for (let x = 0; x < 45; x++) {
            context.fillStyle = (x * 13 + y * 7) % 9 === 0 ? "#81966f" : "#718462";
            context.fillRect(x * 16, y * 16, 16, 16);
          }
          surfaces.forEach((g, groupIndex) => {
            const p = g.batch.parameters, w = p.widthTiles * 16, h = p.heightTiles * 16;
            context.save(); context.beginPath(); context.rect(groupIndex === 0 ? 0 : 360, 0, groupIndex === 0 || surfaces.length === 1 ? 720 : 360, 448); context.clip();
            for (let y = 0; y < 448; y += h) for (let x = 0; x < 720; x += w) {
              const image = g.images[(Math.floor(x / w) * 7 + Math.floor(y / h) * 3) % g.images.length];
              if (image) context.drawImage(image, x, y, w, h);
            }
            context.restore();
          });
          const placements: { image: HTMLImageElement; x: number; y: number; w: number; h: number; ax: number; ay: number }[] = [];
          objects.forEach((g, groupIndex) => {
            const p = g.batch.parameters;
            g.images.forEach((image, i) => {
              if (!image) return;
              const slot = objects.slice(0, groupIndex).filter(g => g.batch.parameters.role === "object").length * 10 + i;
              const x = p.role === "strip" ? 30 + (i % 5) * p.widthTiles * 16 : 38 + (slot % 10) * 70;
              const y = p.role === "strip" ? 390 + Math.floor(i / 5) * 40 : 100 + Math.floor(slot / 10) * 80;
              placements.push({ image, x, y, w: p.widthTiles * 16, h: p.heightTiles * 16, ax: p.anchorX, ay: p.anchorY });
            });
          });
          placements.sort((a, b) => a.y - b.y).forEach(p => {
            context.drawImage(p.image, Math.round(p.x - p.w * p.ax), Math.round(p.y - p.h * p.ay), p.w, p.h);
            if (guides) { context.fillStyle = "#ffd698"; context.fillRect(p.x - 2, p.y - 2, 4, 4); }
          });
        }
        frames++;
        const time = performance.now();
        if (time - last >= 1000) { setFps(Math.round(frames * 1000 / (time - last))); frames = 0; last = time; }
        frame = requestAnimationFrame(draw);
      };
      draw();
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [batches, active, selected, mode, guides]);
  return <figure><canvas ref={ref} width={720} height={448} aria-label={mode === "scene" ? "Generated asset test scene" : "Enlarged mixed-variant seam preview"} /><figcaption>{mode === "scene" ? "16 px tiles · ground patches + depth-sorted objects · anchors shown when guides are on" : "3 × 3 mixed variants · nearest-neighbor enlargement · dashed guides mark boundaries"} · {fps} FPS</figcaption></figure>;
}
