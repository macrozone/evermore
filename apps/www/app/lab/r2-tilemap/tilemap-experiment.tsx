"use client";

import { DEFAULT_MOVEMENT, createMovement, createMovementClock, stepMovement } from "@evermore/core";
import { MovementSettings } from "../../../components/lab/movement-settings";
import { movementSprite } from "../../../components/lab/movement-sprite";
import { createMeadowHouseWorld, getMaterial, MEADOW_HOUSE_LIGHTS, generateObjectVillage, DEFAULT_VILLAGE } from "@evermore/world";
import { Application, Container, Graphics, Assets, Sprite, type Texture } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import { DebugOverlay, type DebugSnapshot } from "../../../components/lab/debug-overlay";
import { movementFromKeys } from "../../../components/lab/keyboard";
import { useMovement } from "../../../components/lab/use-movement";
import { columnTiles, overlapsPlayer, project, RISE, movementFloor, TILE, type Layer, type Tile } from "./tilemap-model";

import { objectLibrary, OBJECT_TILE_SIZE } from "../../../lib/objects";

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
  const [sceneMode, setSceneMode] = useState("village");
  const [seed, setSeed] = useState(20261003);
  const [villageOptions, setVillageOptions] = useState({ ...DEFAULT_VILLAGE });
  const [generation, setGeneration] = useState("");
  const [footprints, setFootprints] = useState(false);
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
      setError("");
      await app.init({ width: WIDTH, height: HEIGHT, background: 0x172b26, antialias: false, resolution: 1, preference: "webgl" });
      initialized = true;
      if (cancelled) { destroy(); return; }
      app.canvas.style.width = "100%";
      app.canvas.style.display = "block";
      app.canvas.style.imageRendering = "pixelated";
      host?.appendChild(app.canvas);
      const generatedAt = performance.now();
      const village = sceneMode === "village" ? generateObjectVillage(objectLibrary, seed, villageOptions) : null;
      const world = village?.world ?? createMeadowHouseWorld();
      const elapsed = performance.now() - generatedAt;
      setGeneration(village ? `${world.width} × ${world.depth} · ${village.placedBuildings}/${village.requestedBuildings} houses · ${village.placements.length} objects · ${elapsed.toFixed(1)} ms · $0 additional AI cost` : "Shared meadow-house comparison");
      const textures = new Map<string, Texture>();
      if (village) {
        await Promise.all(objectLibrary.map(async object => {
          const texture = await Assets.load<Texture>(object.sprite);
          texture.source.scaleMode = "nearest";
          textures.set(object.id, texture);
        }));
        if (cancelled) { destroy(); return; }
      }
      const motion = createMovement({ x: world.spawn.x + 0.5, y: world.spawn.y + 0.5, z: world.spawn.z });
      const advance = createMovementClock();
      const playerCell = () => ({ x: Math.floor(motion.x), y: Math.floor(motion.y), z: motion.z });
      const scene = new Container();
      const ground = new Graphics();
      const objects = new Graphics();
      const avatar = new Graphics();
      const overhead = new Graphics();
      const light = new Graphics();
      const behindSprites = new Container();
      const frontSprites = new Container();
      const footprintGraphics = new Graphics();
      scene.addChild(ground, objects, behindSprites, light, avatar, overhead, frontSprites, footprintGraphics);
      const sprites = (village?.placements ?? []).map(placement => {
        const object = objectLibrary.find(object => object.id === placement.objectId)!;
        const sprite = new Sprite(textures.get(object.id)!);
        const scale = TILE / OBJECT_TILE_SIZE;
        sprite.width = object.width * scale; sprite.height = object.height * scale;
        const foot = project({ x: placement.position.x + object.footprint.columns / 2, y: placement.position.y + object.footprint.rows, z: placement.position.z });
        sprite.position.set(foot.x - sprite.width / 2, foot.y - sprite.height);
        return { placement, object, sprite, foot };
      }).sort((a, b) => a.foot.y !== b.foot.y ? a.foot.y - b.foot.y : a.foot.x - b.foot.x);
      app.stage.addChild(scene);
      function redraw() {
        const player = playerCell();
        ground.clear(); objects.clear(); overhead.clear(); avatar.clear(); light.clear(); footprintGraphics.clear();
        const projected = project(motion);
        const center = { x: Math.round(projected.x), y: Math.round(projected.y) };
        scene.position.set(Math.round(WIDTH / 2 - center.x), Math.round(HEIGHT / 2 - center.y));
        const tiles: Tile[] = [];
        // Extra north/south rows include tall tiles displaced into the viewport.
        for (let y = Math.max(0, player.y - 16); y < Math.min(world.depth, player.y + 24); y++) {
          for (let x = Math.max(0, player.x - 21); x < Math.min(world.width, player.x + 22); x++) {
            // Sprite collision cells must not hide the terrain beneath transparent pixels.
            if (village) tiles.push({ x, y, z: 3, material: world.getCell(x, y, 2), layer: "ground" });
            else tiles.push(...columnTiles(world, x, y, player, cutaway));
          }
        }
        tiles.sort((a, b) => (a.y - b.y) * 10000 + (a.z - b.z) * 100 + a.x - b.x);
        for (const tile of tiles) {
          if (!layers[tile.layer] || (village && tile.layer !== "ground")) continue;
          const alpha = fade && overlapsPlayer(tile, player) && tile.layer === "overhead" ? 0.25 : 1;
          // Objects behind the player belong below the avatar; foreground objects above.
          const graphics = tile.layer === "ground" ? ground : tile.layer === "objects" && tile.y <= player.y ? objects : overhead;
          drawTile(graphics, tile, alpha);
        }
        for (const entry of sprites) {
          const { sprite, foot, object, placement } = entry;
          const inFront = foot.y > center.y;
          (inFront ? frontSprites : behindSprites).addChild(sprite);
          sprite.visible = layers.objects && sprite.x + sprite.width >= center.x - WIDTH / 2 && sprite.x <= center.x + WIDTH / 2 && sprite.y + sprite.height >= center.y - HEIGHT / 2 && sprite.y <= center.y + HEIGHT / 2;
          const overlaps = center.x >= sprite.x && center.x < sprite.x + sprite.width && center.y >= sprite.y && center.y - TILE < foot.y;
          sprite.alpha = fade && inFront && overlaps ? 0.3 : 1;
          if (footprints && sprite.visible) {
            for (const [dx, dy] of object.footprint.occupied) {
              const p = project({ x: placement.position.x + dx, y: placement.position.y + dy, z: 3 });
              footprintGraphics.rect(p.x, p.y, TILE, TILE).stroke({ color: 0xffca64, width: 1 });
            }
            if (placement.entrance) {
              const door = project(placement.entrance);
              footprintGraphics.rect(door.x, door.y, TILE, TILE).stroke({ color: 0x99e9c0, width: 2 });
            }
          }
          if (sprite.visible && object.id === "lantern") {
            light.ellipse(foot.x, foot.y - TILE, TILE * 2, TILE).fill({ color: 0xffcd72, alpha: 0.15 });
          }
        }
        for (const source of village ? [] : MEADOW_HOUSE_LIGHTS) {
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
        setRoom(village ? "Library village" : world.structuresAt(player.x, player.y, player.z)[0]?.name ?? "Meadow");
      }
      redraw();
      let sample = 0;
      let frames = 0;
      app.ticker.add((ticker) => {
        const delta = Math.min(ticker.deltaMS / 1000, 0.05);
        const direction = movementFromKeys(keys.current);
        advance(delta, () => stepMovement(motion, direction, movement, (p) => movementFloor(world, p)));
        redraw();
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
  }, [keys, movement, cutaway, fade, layers, reset, sceneMode, seed, villageOptions, footprints]);

  const settings = JSON.stringify({ scene: sceneMode, seed, villageOptions, movement, cutaway, fade, layers, footprints }, null, 2);
  return (
    <div className="grid gap-5">
      <div className="relative">
        <div ref={surface} tabIndex={0} role="application" aria-label="Tilemap world. Use WASD or arrow keys to move."
          className="aspect-[5/3] w-full overflow-hidden rounded border border-dusk focus:outline-2 focus:outline-gold" />
        <DebugOverlay {...snapshot} />
        <fieldset className="absolute right-2 top-2 max-h-[70%] w-48 overflow-auto rounded border border-dusk bg-night/95 p-3 text-xs text-mist">
          <legend className="sr-only">Village controls</legend>
          <label className="block">Scene<select aria-label="Scene" value={sceneMode} onChange={event => setSceneMode(event.target.value)} className="block w-full bg-night p-1"><option value="village">G3 library village</option><option value="meadow">Meadow house</option></select></label>
          {sceneMode === "village" && <>
            <label className="mt-2 block">Seed<input aria-label="Village seed" type="number" min={0} max={4294967295} value={seed} onChange={event => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 0 && value <= 4294967295) setSeed(value); }} className="block w-full bg-night p-1" /></label>
            <label className="mt-2 block">Map size<select aria-label="Map size" value={villageOptions.size} onChange={event => setVillageOptions({ ...villageOptions, size: Number(event.target.value) })} className="block w-full bg-night p-1">{[48, 64, 96, 128].map(size => <option key={size} value={size}>{size} × {size}</option>)}</select></label>
            <label className="mt-2 block">Houses: {villageOptions.buildings}<input aria-label="House count" type="range" min={0} max={60} value={villageOptions.buildings} onChange={event => setVillageOptions({ ...villageOptions, buildings: Number(event.target.value) })} className="w-full" /></label>
            <label className="mt-2 block">Edge trees: {villageOptions.edgeDensity}<input aria-label="Edge density" type="range" min={0} max={0.3} step={0.01} value={villageOptions.edgeDensity} onChange={event => setVillageOptions({ ...villageOptions, edgeDensity: Number(event.target.value) })} className="w-full" /></label>
            <label className="block"><input type="checkbox" checked={footprints} onChange={event => setFootprints(event.target.checked)} /> Footprints / doors</label>
          </>}
          <label className="mt-2 block"><input type="checkbox" checked={fade} onChange={event => setFade(event.target.checked)} /> Fade occluders</label>
          <button type="button" onClick={() => setReset(reset + 1)} className="mt-2 rounded border border-gold px-2 py-1">Reset player</button>
        </fieldset>
      </div>
      {error !== "" && <p role="alert">{error}</p>}
      <p aria-live="polite">Location: {room} · {generation}</p>
      <fieldset className="flex flex-wrap gap-5 rounded border border-dusk p-4">
        <legend className="px-2">Renderer settings</legend>
        <MovementSettings value={movement} onChange={setMovement} />
        <label><input type="checkbox" checked={cutaway} onChange={(event) => setCutaway(event.target.checked)} /> Building cutaway</label>
        <label><input type="checkbox" checked={fade} onChange={(event) => setFade(event.target.checked)} /> Fade occluders</label>
        {(["ground", "objects", "overhead"] as const).map((layer) => <label key={layer}><input type="checkbox" checked={layers[layer]} onChange={(event) => setLayers({ ...layers, [layer]: event.target.checked })} /> {layer}</label>)}
        <button type="button" onClick={() => setReset(reset + 1)} className="rounded border border-gold px-3 py-1">Reset to door</button>
      </fieldset>
      <p className="text-sm text-mist">Changing settings resets the player. Village generation reuses the seven library sprites without model calls. Green footprint markers show reachable door approaches; houses are exterior objects in this slice. The meadow scene retains interiors and stairs. Movement uses a shared 60 Hz simulation. Try wall sliding, doorway corners and the stairs.</p>
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
