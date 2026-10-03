"use client";

import { RenderStats, useRenderStats } from "../../../components/lab/render-stats";

import { LabViewport } from "../../../components/lab/lab-viewport";

import { DEFAULT_MOVEMENT, createMovement, createMovementClock, stepMovement } from "@evermore/core";
import { MovementSettings } from "../../../components/lab/movement-settings";
import { movementSprite } from "../../../components/lab/movement-sprite";
import { createMeadowHouseWorld, getMaterial, MEADOW_HOUSE_LIGHTS } from "@evermore/world";
import { Application, Container, Graphics } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import { DebugOverlay, type DebugSnapshot } from "../../../components/lab/debug-overlay";
import { movementFromKeys } from "../../../components/lab/keyboard";
import { useMovement } from "../../../components/lab/use-movement";
import { columnTiles, overlapsPlayer, project, RISE, movementFloor, TILE, type Layer, type Tile } from "./tilemap-model";

import { tilePattern } from "./tile-pattern";

const WIDTH = 800;
const HEIGHT = 480;

function drawTile(graphics: Graphics, tile: Tile, alpha: number) {
  const { x, y } = project(tile);
  const material = getMaterial(tile.material);
  // A short front face conveys height without turning the map into voxel art.
  if (tile.z > 3) graphics.rect(x, y + TILE, TILE, RISE).fill({ color: material.color, alpha: alpha * 0.6 });
  graphics.rect(x, y, TILE, TILE).fill({ color: material.color, alpha });
  for (const mark of tilePattern(tile.material, tile.x, tile.y)) {
    graphics.rect(x + mark.x, y + mark.y, mark.width, mark.height).fill({ color: mark.color, alpha });
  }
}

export default function TilemapExperiment() {
  const { stats: performanceStats, recordFrame } = useRenderStats();
  const surface = useRef<HTMLDivElement>(null);
  const keys = useMovement(surface);
  const [movement, setMovement] = useState({ ...DEFAULT_MOVEMENT });
  const [cutaway, setCutaway] = useState(true);
  const [fade, setFade] = useState(true);
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ ground: true, objects: true, overhead: true });
  const [reset, setReset] = useState(0);
  const [error, setError] = useState("");
  const [room, setRoom] = useState("Meadow");
  const [copyStatus, setCopyStatus] = useState("");
  const [snapshot, setSnapshot] = useState<DebugSnapshot>({ fps: 0, position: { x: 12, y: 45, z: 3 }, seed: "20261002" });

  useEffect(() => {
    const host = surface.current;
    if (!host) return;
    const app = new Application();
    let cancelled = false;
    let initialized = false;
    let destroyed = false;
    const destroy = () => {
      if (initialized && !destroyed) {
        destroyed = true;
        app.destroy({ removeView: true }, { children: true });
      }
    };
    async function start() {
      await app.init({ width: WIDTH, height: HEIGHT, background: 0x172b26, antialias: false, resolution: 1, preference: "webgl" });
      initialized = true;
      if (cancelled) { destroy(); return; }
      app.canvas.style.width = "100%";
      app.canvas.style.display = "block";
      app.canvas.style.imageRendering = "pixelated";
      host?.appendChild(app.canvas);
      const world = createMeadowHouseWorld();
      const motion = createMovement({ x: world.spawn.x + 0.5, y: world.spawn.y + 0.5, z: world.spawn.z });
      const advance = createMovementClock();
      const playerCell = () => ({ x: Math.floor(motion.x), y: Math.floor(motion.y), z: motion.z });
      const scene = new Container();
      const ground = new Graphics();
      const objects = new Graphics();
      const avatar = new Graphics();
      const overhead = new Graphics();
      const light = new Graphics();
      scene.addChild(ground, objects, light, avatar, overhead);
      app.stage.addChild(scene);
      function redraw() {
        const player = playerCell();
        ground.clear(); objects.clear(); overhead.clear(); avatar.clear(); light.clear();
        const projected = project(motion);
        const center = { x: Math.round(projected.x), y: Math.round(projected.y) };
        scene.position.set(Math.round(WIDTH / 2 - center.x), Math.round(HEIGHT / 2 - center.y));
        const tiles: Tile[] = [];
        // Extra north/south rows include tall tiles displaced into the viewport.
        for (let y = Math.max(0, player.y - 16); y < Math.min(world.depth, player.y + 24); y++) {
          for (let x = Math.max(0, player.x - 21); x < Math.min(world.width, player.x + 22); x++) tiles.push(...columnTiles(world, x, y, player, cutaway));
        }
        tiles.sort((a, b) => (a.y - b.y) * 10000 + (a.z - b.z) * 100 + a.x - b.x);
        for (const tile of tiles) {
          if (!layers[tile.layer]) continue;
          const alpha = fade && overlapsPlayer(tile, player) && tile.layer === "overhead" ? 0.25 : 1;
          // Objects behind the player belong below the avatar; foreground objects above.
          const graphics = tile.layer === "ground" ? ground : tile.layer === "objects" && tile.y <= player.y ? objects : overhead;
          drawTile(graphics, tile, alpha);
        }
        for (const source of MEADOW_HOUSE_LIGHTS) {
          const inside = world.structuresAt(player.x, player.y, player.z).some((s) => s.id === "house");
          if (source.id === "hearth" && !inside) continue;
          const position = project(source);
          for (let ring = source.radius; ring > 0; ring--) {
            light.ellipse(position.x + TILE / 2, position.y + TILE / 2, ring * TILE, ring * TILE * 0.65)
              .fill({ color: source.color, alpha: 0.055 });
          }
        }
        avatar.ellipse(center.x, center.y + 2, 7, 3).fill({ color: 0x101820, alpha: 0.4 });
        for (const mark of movementSprite(motion)) {
          avatar.rect(center.x + mark.x, center.y + mark.y, mark.width, mark.height).fill(mark.color);
        }
        setRoom(world.structuresAt(player.x, player.y, player.z)[0]?.name ?? "Meadow");
      }
      app.stop();
      app.ticker.remove(app.render, app);
      app.ticker.start();
      redraw();
      let sample = 0;
      let frames = 0;
      app.ticker.add((ticker) => {
        const started = performance.now();
        const delta = Math.min(ticker.deltaMS / 1000, 0.05);
        const direction = movementFromKeys(keys.current);
        advance(delta, () => stepMovement(motion, direction, movement, (p) => movementFloor(world, p)));
        redraw();
        app.render();
        recordFrame(performance.now() - started);
        sample += delta; frames++;
        if (sample >= 0.25) {
          setSnapshot({ fps: frames / sample, position: { x: motion.x, y: motion.y, z: motion.z }, seed: String(world.seed) });
          frames = 0; sample = 0;
        }
      });
    }
    void start().catch(() => {
      destroy();
      if (!cancelled) setError("The renderer could not start. Enable WebGL and reload this page.");
    });
    return () => { cancelled = true; destroy(); };
  }, [keys, movement, cutaway, fade, layers, reset, recordFrame]);

  const settings = JSON.stringify({ seed: 20261002, movement, cutaway, fade, layers }, null, 2);
  return (
    <LabViewport title="R2 · Layered tilemap" description="Focus the world and move with WASD or arrow keys. Enter the house through its south door, cross the river on the bridge, then follow the path to the hill stairs and tower." controls={<>
      {error !== "" && <p role="alert">{error}</p>}
      <p aria-live="polite">Location: {room}</p>
      <fieldset className="flex flex-wrap gap-5 rounded border border-dusk p-4">
        <legend className="px-2">Renderer settings</legend>
        <MovementSettings value={movement} onChange={setMovement} />
        <label><input type="checkbox" checked={cutaway} onChange={(event) => setCutaway(event.target.checked)} /> Building cutaway</label>
        <label><input type="checkbox" checked={fade} onChange={(event) => setFade(event.target.checked)} /> Fade occluders</label>
        {(["ground", "objects", "overhead"] as const).map((layer) => <label key={layer}><input type="checkbox" checked={layers[layer]} onChange={(event) => setLayers({ ...layers, [layer]: event.target.checked })} /> {layer}</label>)}
        <button type="button" onClick={() => setReset(reset + 1)} className="rounded border border-gold px-3 py-1">Reset to door</button>
      </fieldset>
      <p className="text-sm text-mist">Changing settings resets the player. The shared test-world seed is fixed for comparisons. Movement uses a shared 60 Hz simulation. Try wall sliding, doorway corners and the stairs.</p>
      <details><summary>Settings JSON</summary>
        <textarea readOnly value={settings} rows={12} aria-label="Settings JSON" className="mt-3 w-full rounded bg-black/30 p-3 font-mono text-sm" />
        <button type="button" className="rounded border border-gold px-3 py-1" onClick={() => {
          if (typeof navigator.clipboard === "undefined") { setCopyStatus("Select and copy the JSON above."); return; }
          void navigator.clipboard.writeText(settings).then(() => setCopyStatus("Copied settings."), () => setCopyStatus("Select and copy the JSON above."));
        }}>Copy settings</button><p role="status">{copyStatus}</p>
      </details>
      <p className="text-sm text-mist">Procedural placeholder tiles, shared meadow-house world. Height shifts tiles upward; floors inside the current building are cut away above your head. Overlapping roofs and foliage fade. This fixed view cannot show every stacked surface at once; use the layer controls to inspect it.</p>
    </>}>
      <div className="relative h-full">
        <div ref={surface} tabIndex={0} role="application" aria-label="Meadow-house tilemap. Use WASD or arrow keys to move."
          className="h-full w-full overflow-hidden focus:outline-2 focus:outline-gold" />
        <DebugOverlay {...snapshot} />
        <RenderStats stats={performanceStats} />
      </div>
    </LabViewport>
  );
}
