"use client";

import { createMeadowHouseWorld, getMaterial } from "@evermore/world";
import { Application, Container, Graphics } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import { DebugOverlay, type DebugSnapshot } from "../../../components/lab/debug-overlay";
import { movementFromKeys } from "../../../components/lab/keyboard";
import { useMovement } from "../../../components/lab/use-movement";
import { columnTiles, overlapsPlayer, project, RISE, stepPlayer, TILE, type Layer, type Tile } from "./tilemap-model";

const WIDTH = 800;
const HEIGHT = 480;

function drawTile(graphics: Graphics, tile: Tile, alpha: number) {
  const { x, y } = project(tile);
  const material = getMaterial(tile.material);
  // A short front face conveys height without turning the map into voxel art.
  if (tile.z > 3) graphics.rect(x, y + TILE, TILE, RISE).fill({ color: material.color, alpha: alpha * 0.6 });
  graphics.rect(x, y, TILE, TILE).fill({ color: material.color, alpha });
  const pattern = (tile.x * 17 + tile.y * 31 + material.tileIndex) % 5;
  graphics.rect(x + 3 + pattern, y + 5, 3, 2).fill({ color: 0xffffff, alpha: alpha * 0.14 });
  if (material.key === "stairs" || material.key === "planks") {
    for (let line = 4; line < TILE; line += 5) graphics.rect(x, y + line, TILE, 1).fill({ color: 0x211b20, alpha: alpha * 0.35 });
  }
  if (material.key === "water") graphics.rect(x + 4, y + 12, 10, 1).fill({ color: 0xd4ecff, alpha: alpha * 0.5 });
}

export default function TilemapExperiment() {
  const surface = useRef<HTMLDivElement>(null);
  const keys = useMovement(surface);
  const [speed, setSpeed] = useState(8);
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
      let player = { ...world.spawn };
      const scene = new Container();
      const ground = new Graphics();
      const objects = new Graphics();
      const avatar = new Graphics();
      const overhead = new Graphics();
      scene.addChild(ground, objects, avatar, overhead);
      app.stage.addChild(scene);
      function redraw() {
        ground.clear(); objects.clear(); overhead.clear(); avatar.clear();
        const center = project({ x: player.x + 0.5, y: player.y + 0.5, z: player.z });
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
        avatar.ellipse(center.x, center.y + 2, 7, 3).fill({ color: 0x101820, alpha: 0.4 });
        avatar.rect(center.x - 5, center.y - 12, 10, 11).fill(0xeee0a7);
        avatar.rect(center.x - 4, center.y - 20, 8, 8).fill(0xd8956b);
        avatar.rect(center.x - 5, center.y - 22, 10, 4).fill(0x452e2b);
        setRoom(world.structuresAt(player.x, player.y, player.z)[0]?.name ?? "Meadow");
      }
      redraw();
      let elapsed = 0;
      let sample = 0;
      let frames = 0;
      app.ticker.add((ticker) => {
        const delta = Math.min(ticker.deltaMS / 1000, 0.05);
        const direction = movementFromKeys(keys.current);
        elapsed += delta;
        if (direction.x === 0 && direction.y === 0) elapsed = 1 / speed;
        else if (elapsed >= 1 / speed) {
          elapsed = 0;
          // Cardinal grid movement prevents diagonal corner clipping.
          const dx = Math.sign(direction.x);
          const dy = Math.sign(direction.y);
          let next = dx !== 0 ? stepPlayer(world, player, dx, 0) : stepPlayer(world, player, 0, dy);
          if (next === player && dx !== 0 && dy !== 0) next = stepPlayer(world, player, 0, dy);
          if (next !== player) { player = next; redraw(); }
        }
        sample += delta; frames++;
        if (sample >= 0.25) {
          setSnapshot({ fps: frames / sample, position: { ...player }, seed: String(world.seed) });
          frames = 0; sample = 0;
        }
      });
    }
    void start().catch(() => {
      destroy();
      if (!cancelled) setError("The renderer could not start. Enable WebGL and reload this page.");
    });
    return () => { cancelled = true; destroy(); };
  }, [keys, speed, cutaway, fade, layers, reset]);

  const settings = JSON.stringify({ seed: 20261002, speed, cutaway, fade, layers }, null, 2);
  return (
    <div className="grid gap-5">
      <div className="relative">
        <div ref={surface} tabIndex={0} role="application" aria-label="Meadow-house tilemap. Use WASD or arrow keys to move."
          className="aspect-[5/3] w-full overflow-hidden rounded border border-dusk focus:outline-2 focus:outline-gold" />
        <DebugOverlay {...snapshot} />
      </div>
      {error !== "" && <p role="alert">{error}</p>}
      <p aria-live="polite">Location: {room}</p>
      <fieldset className="flex flex-wrap gap-5 rounded border border-dusk p-4">
        <legend className="px-2">Renderer settings</legend>
        <label>Speed ({speed} cells/s) <input type="range" min={2} max={12} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /></label>
        <label><input type="checkbox" checked={cutaway} onChange={(event) => setCutaway(event.target.checked)} /> Building cutaway</label>
        <label><input type="checkbox" checked={fade} onChange={(event) => setFade(event.target.checked)} /> Fade occluders</label>
        {(["ground", "objects", "overhead"] as const).map((layer) => <label key={layer}><input type="checkbox" checked={layers[layer]} onChange={(event) => setLayers({ ...layers, [layer]: event.target.checked })} /> {layer}</label>)}
        <button type="button" onClick={() => setReset(reset + 1)} className="rounded border border-gold px-3 py-1">Reset to door</button>
      </fieldset>
      <p className="text-sm text-mist">Changing settings resets the player. The shared test-world seed is fixed for comparisons. Movement snaps to cells; diagonal input prefers the horizontal axis.</p>
      <details><summary>Settings JSON</summary>
        <textarea readOnly value={settings} rows={12} aria-label="Settings JSON" className="mt-3 w-full rounded bg-black/30 p-3 font-mono text-sm" />
        <button type="button" className="rounded border border-gold px-3 py-1" onClick={() => {
          if (typeof navigator.clipboard === "undefined") { setCopyStatus("Select and copy the JSON above."); return; }
          void navigator.clipboard.writeText(settings).then(() => setCopyStatus("Copied settings."), () => setCopyStatus("Select and copy the JSON above."));
        }}>Copy settings</button><p role="status">{copyStatus}</p>
      </details>
    </div>
  );
}
