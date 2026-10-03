"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RASTER_LEGEND, compileRasterMap, generateWorld, getMaterial, type World } from "@evermore/world";
import type { BookGeneration } from "./generation";
import styles from "./book.module.css";

export default function MapPreview({ generation }: { generation: BookGeneration }) {
  const [layer, setLayer] = useState(1);
  const [raw, setRaw] = useState(false);
  const [composite, setComposite] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);
  const world = useMemo(() => generation.strategy === "g2" ? compileRasterMap(generation.repairedRaster, generation.seed).world : generateWorld(generation.specification, generation.seed), [generation]);
  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    const scale = 8;
    for (let y = 0; y < world.depth; y++) for (let x = 0; x < world.width; x++) {
      const cell = (w: World) => {
        if (generation.strategy === "g1") {
          // Cut away roofs: show the lowest walkable floor, with walls and objects at player height.
          let floor = 1;
          for (; floor < w.height - 1; floor++) if (w.isWalkable(x, y, floor)) break;
          if (floor >= w.height - 1) floor = Math.max(1, w.heightAt(x, y) - 1);
          const atFeet = w.getCell(x, y, floor);
          return atFeet !== 0 ? atFeet : w.getCell(x, y, floor - 1);
        }
        return w.getCell(x, y, layer);
      };
      let id = cell(world);
      if (generation.strategy === "g2") {
        const at = (z: number) => raw ? RASTER_LEGEND[generation.raster.layers[z]![y]![x] as keyof typeof RASTER_LEGEND] : world.getCell(x, y, z);
        id = at(layer);
        for (let z = layer - 1; composite && id === 0 && z >= 0; z--) id = at(z);
      }
      const material = getMaterial(id);
      context.fillStyle = id === 0 ? "#102019" : `#${material.color.toString(16).padStart(6, "0")}`;
      context.fillRect(x * scale, y * scale, scale, scale);
    }
    context.fillStyle = "#fff0b8";
    context.fillRect(world.spawn.x * scale + 2, world.spawn.y * scale + 2, 4, 4);
    if (generation.strategy === "g2") {
      context.strokeStyle = "#ffcb79";
      for (const b of generation.raster.buildings) context.strokeRect(b.door.x * scale + 1, b.door.y * scale + 1, 6, 6);
    }
  }, [generation, world, layer, raw, composite]);
  return <div className={styles.mapPreview}>
    <canvas ref={canvas} width={world.width * 8} height={world.depth * 8} role="img" aria-label={`${world.name}, ${world.width} by ${world.depth} cells. Spawn marked in cream; G2 doors outlined in gold.`} />
    <div>
      <p>{world.name} · {world.width}×{world.depth}×{world.height}</p>
      {generation.strategy === "g2" && <>
        <label>Height layer · z={layer}<input type="range" min={0} max={3} value={layer} onChange={event => setLayer(Number(event.target.value))} /></label>
        <label><input type="checkbox" checked={raw} onChange={event => setRaw(event.target.checked)} /> Show original model cells</label>
        <label><input type="checkbox" checked={composite} onChange={event => setComposite(event.target.checked)} /> Show lower layers through air</label>
        <p>z0 ground · z1 / z2 walls and headroom · z3 roofs</p>
        <p>Legend: g grass · p path · w water · f wood · # wall · r roof · b bed · t trunk · . air</p>
        <p>{generation.report.changedCells} cells repaired: {generation.report.wallRepairs} wall/roof, {generation.report.floorRepairs} floor, {generation.report.doorRepairs} doorway, {generation.report.routeRepairs} route.</p>
        <p>Doors / marked paths: {generation.report.unreachableBefore} unreachable before repair; {generation.report.reachableAfter}/{generation.report.targets} reachable after repair.</p>
        <p>Repairs enforce declared rectangular houses and exterior routes. They do not verify whether the map matches your story.</p>
      </>}
      {generation.strategy === "g1" && <p>G1 builds terrain, houses and routes from a semantic specification. Preview shows a floor cutaway.</p>}
    </div>
  </div>;
}
