"use client";

import { DEFAULT_MOVEMENT, createMovement, createMovementClock, interpolateMovement, movementFrame, stepMovement } from "@evermore/core";
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

  const options = useRef({ movement, cutaway, fade, layers });
  useEffect(() => { options.current = { movement, cutaway, fade, layers }; }, [movement, cutaway, fade, layers]);

  useEffect(() => {
    const host = surface.current;
    if (!host) return;
    const app = new Application();
    let cancelled = false;
    let initialized = false;
    let destroyed = false;
    let resize: ResizeObserver | undefined;
    const destroy = () => {
      if (initialized && !destroyed) {
        destroyed = true;
        resize?.disconnect();
        app.destroy({ removeView: true }, { children: true });
      }
    };
    async function start() {
      await app.init({ width: host?.clientWidth ?? WIDTH, height: host?.clientHeight ?? HEIGHT, background: 0x172b26, antialias: false, resolution: 1, preference: "webgl" });
      initialized = true;
      if (cancelled) { destroy(); return; }
      app.canvas.style.width = "100%";
      app.canvas.style.height = "100%";
      app.canvas.style.display = "block";
      app.canvas.style.imageRendering = "pixelated";
      host?.appendChild(app.canvas);
      resize = new ResizeObserver(() => {
        if (host && !destroyed) app.renderer.resize(host.clientWidth, host.clientHeight);
      });
      if (host) resize.observe(host);
      const world = createMeadowHouseWorld();
      const motion = createMovement({ x: world.spawn.x + 0.5, y: world.spawn.y + 0.5, z: world.spawn.z });
      const advance = createMovementClock();
      let previous = { ...motion };
      const playerCell = () => ({ x: Math.floor(motion.x), y: Math.floor(motion.y), z: motion.z });
      const scene = new Container();
      const ground = new Graphics();
      const objects = new Graphics();
      const avatar = new Graphics();
      const overhead = new Graphics();
      const light = new Graphics();
      const background = new Container();
      const foreground = new Container();
      background.addChild(ground, objects, light);
      foreground.addChild(overhead);
      background.cacheAsTexture({ antialias: false, scaleMode: "nearest" });
      foreground.cacheAsTexture({ antialias: false, scaleMode: "nearest" });
      scene.addChild(background, avatar, foreground);
      app.stage.addChild(scene);
      let worldKey = "";
      let spriteKey = "";
      const camera = project(motion);
      function redraw(delta = 0, alpha = 0) {
        const player = playerCell();
        const { cutaway, fade, layers } = options.current;
        const center = project(interpolateMovement(previous, motion, alpha));
        const follow = 1 - Math.exp(-12 * delta);
        camera.x += (center.x - camera.x) * follow;
        camera.y += (center.y - camera.y) * follow;
        scene.position.set(app.screen.width / 2 - camera.x, app.screen.height / 2 - camera.y);
        avatar.position.set(center.x, center.y);
        const nextWorldKey = JSON.stringify({ player, cutaway, fade, layers, width: app.screen.width, height: app.screen.height });
        if (nextWorldKey !== worldKey) {
          worldKey = nextWorldKey;
          ground.clear(); objects.clear(); overhead.clear(); light.clear();
          const tiles: Tile[] = [];
          // Include camera lag and tall tiles displaced into the viewport.
          const columns = Math.ceil(app.screen.width / (2 * TILE)) + 3;
          const rows = Math.ceil(app.screen.height / (2 * TILE)) + 3;
          for (let y = Math.max(0, player.y - rows); y < Math.min(world.depth, player.y + rows + 12); y++) {
            for (let x = Math.max(0, player.x - columns); x < Math.min(world.width, player.x + columns + 1); x++) tiles.push(...columnTiles(world, x, y, player, cutaway));
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
          background.updateCacheTexture();
          foreground.updateCacheTexture();
          setRoom(world.structuresAt(player.x, player.y, player.z)[0]?.name ?? "Meadow");
        }
        const nextSpriteKey = `${motion.facing}:${motion.moving}:${movementFrame(motion)}`;
        if (nextSpriteKey !== spriteKey) {
          spriteKey = nextSpriteKey;
          avatar.clear();
          avatar.ellipse(0, 2, 7, 3).fill({ color: 0x101820, alpha: 0.4 });
          for (const mark of movementSprite(motion)) {
            avatar.rect(mark.x, mark.y, mark.width, mark.height).fill(mark.color);
          }
        }
      }
      redraw();
      let sample = 0;
      let frames = 0;
      const frameTimes: number[] = [];
      app.ticker.add((ticker) => {
        const elapsed = ticker.elapsedMS / 1000;
        const delta = Math.min(elapsed, 0.05);
        frameTimes.push(ticker.elapsedMS);
        if (frameTimes.length > 120) frameTimes.shift();
        const direction = movementFromKeys(keys.current);
        const alpha = advance(elapsed, () => {
          previous = { ...motion };
          stepMovement(motion, direction, options.current.movement, (p) => movementFloor(world, p));
        });
        redraw(delta, alpha);
        sample += elapsed; frames++;
        if (sample >= 0.25) {
          setSnapshot({ fps: frames / sample, position: { x: motion.x, y: motion.y, z: motion.z }, seed: String(world.seed), velocity: { x: motion.vx, y: motion.vy }, frameTimes: [...frameTimes] });
          frames = 0; sample = 0;
        }
      });
    }
    void start().catch(() => {
      destroy();
      if (!cancelled) setError("The renderer could not start. Enable WebGL and reload this page.");
    });
    return () => { cancelled = true; destroy(); };
  }, [keys, reset]);

  const settings = JSON.stringify({ seed: 20261002, movement, cutaway, fade, layers }, null, 2);
  return (
    <div className="grid min-w-0 grid-cols-1 gap-5">
      <div className="sticky top-0 min-w-0 rounded bg-night [&>dl]:top-auto [&>dl]:bottom-12">
        <div ref={surface} tabIndex={0} role="application" aria-label="Meadow-house tilemap. Use WASD or arrow keys to move."
          className="aspect-[5/3] min-h-[600px] sm:min-h-[420px] w-full overflow-hidden rounded border border-dusk focus:outline-2 focus:outline-gold" />
        <DebugOverlay {...snapshot} />
        <p aria-live="polite" className="pointer-events-none absolute bottom-3 left-3 rounded bg-night/90 px-3 py-1 text-sm text-snow">Location: {room}</p>
        <details open className="absolute right-3 top-3 max-h-[60%] sm:max-h-[calc(100%-24px)] w-36 sm:w-56 overflow-y-auto rounded border border-dusk bg-night/95 p-3 text-xs">
          <summary className="cursor-pointer text-sm text-gold">Renderer settings</summary>
          <fieldset className="mt-3 grid gap-3">
            <legend className="sr-only">Renderer settings</legend>
            <MovementSettings value={movement} onChange={setMovement} />
            <label><input type="checkbox" checked={cutaway} onChange={(event) => setCutaway(event.target.checked)} /> Building cutaway</label>
            <label><input type="checkbox" checked={fade} onChange={(event) => setFade(event.target.checked)} /> Fade occluders</label>
            {(["ground", "objects", "overhead"] as const).map((layer) => <label key={layer}><input type="checkbox" checked={layers[layer]} onChange={(event) => setLayers({ ...layers, [layer]: event.target.checked })} /> {layer}</label>)}
            <button type="button" onClick={() => setReset(reset + 1)} className="rounded border border-gold px-3 py-1">Reset to door</button>
          </fieldset>
          <details><summary>Settings JSON</summary>
            <textarea readOnly value={settings} rows={12} aria-label="Settings JSON" className="mt-3 w-full rounded bg-night p-3 font-mono text-sm" />
            <button type="button" className="rounded border border-gold px-3 py-1" onClick={() => {
              if (typeof navigator.clipboard === "undefined") { setCopyStatus("Select and copy the JSON above."); return; }
              void navigator.clipboard.writeText(settings).then(() => setCopyStatus("Copied settings."), () => setCopyStatus("Select and copy the JSON above."));
            }}>Copy settings</button><p role="status">{copyStatus}</p>
          </details>
        </details>
      </div>
      {error !== "" && <p role="alert">{error}</p>}
      <p className="text-sm text-mist">Click the world, then hold WASD or arrow keys. Try diagonals, wall sliding, doorway corners and stairs. Settings apply live. The shared 60 Hz simulation is interpolated on every display frame.</p>
    </div>
  );
}
