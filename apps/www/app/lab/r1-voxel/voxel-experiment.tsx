"use client";

import { DEFAULT_MOVEMENT, createMovement, createMovementClock, stepMovement } from "@evermore/core";
import { MEADOW_HOUSE_SEED, WORLD_EXAMPLES, generateWorld, deriveShadowWorld, findInfluenceOrigin, influenceAt } from "@evermore/world";
import { useEffect, useRef, useState } from "react";
import { AmbientLight, Box3, Color, DirectionalLight, Group, Mesh, MeshLambertMaterial, OrthographicCamera, Scene, WebGLRenderer, WebGLRenderTarget, NearestFilter, DepthTexture, AlwaysDepth, ShaderMaterial, PlaneGeometry, PCFShadowMap, Vector3, CanvasTexture, Sprite, SpriteMaterial } from "three";

import { movementFromKeys } from "../../../components/lab/keyboard";
import { MovementSettings } from "../../../components/lab/movement-settings";
import { movementSprite } from "../../../components/lab/movement-sprite";
import { useWorldHandoff } from "../../../components/lab/use-world-handoff";
import { useMovement } from "../../../components/lab/use-movement";
import { cameraMovement, DEFAULT_FOLLOW, followBlend, voxelMovementFloor } from "./player-model";
import { CAMERA_PRESETS, DEFAULT_CAMERA, fitCamera, meshChunk, type CameraSettings } from "./voxel-model";
import { advanceHour, clockLabel, daylightAt, DEFAULT_LIGHTING, type LightingSettings } from "./daylight";
import { createLocalLights } from "./local-lights";
import { DEFAULT_LOOK, LOOK_FRAGMENT, playerFocusDepth, renderDimensions, type LookSettings } from "./pixel-look";
import { GenerationPanel } from "./generation-panel";
const PLAYER_CAMERA = { ...DEFAULT_CAMERA, zoom: 2.2 };

export default function VoxelExperiment() {
  const { handoff, error: importError, ready } = useWorldHandoff();
  const [selectedWorld, setSelectedWorld] = useState<{ index: number; seed: string | number; revision: number } | null>(null);
  const worldIndex = selectedWorld?.index === -2 && !handoff ? -1 : selectedWorld?.index ?? (handoff ? -2 : -1);
  const imported = worldIndex === -2 ? handoff : null;
  const worldSeed = worldIndex === -1 ? MEADOW_HOUSE_SEED : selectedWorld?.seed ?? imported?.seed ?? MEADOW_HOUSE_SEED;
  const generationRevision = selectedWorld?.revision ?? 0;
  const [generationMs, setGenerationMs] = useState(0);
  const worldName = imported ? imported.specification.name : worldIndex === -1 ? "meadow-house" : WORLD_EXAMPLES[worldIndex]!.name;
  const [shadow, setShadow] = useState(false);
  const [heatmap, setHeatmap] = useState(false);
  const surface = useRef<HTMLDivElement>(null);
  const keys = useMovement(surface);
  const [movement, setMovement] = useState({ ...DEFAULT_MOVEMENT });
  const currentMovement = useRef(movement);
  const [follow, setFollow] = useState(DEFAULT_FOLLOW);
  const currentFollow = useRef(follow);
  const resetPlayer = useRef<(() => void) | null>(null);
  const [playerPosition, setPlayerPosition] = useState({ x: 12.5, y: 45.5, z: 3 });
  const updateView = useRef<((settings: CameraSettings, look: LookSettings, lighting: LightingSettings) => void) | null>(null);
  const currentSettings = useRef(PLAYER_CAMERA);
  const currentLook = useRef(DEFAULT_LOOK);
  const currentLighting = useRef(DEFAULT_LIGHTING);
  const animationSeconds = useRef(0);
  const [performanceStats, setPerformanceStats] = useState({ fps: 0, frameMs: 0, calls: 0 });
  const [lighting, setLighting] = useState(DEFAULT_LIGHTING);
  const [look, setLook] = useState(DEFAULT_LOOK);
  const [settings, setSettings] = useState(PLAYER_CAMERA);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [worldStart, setWorldStart] = useState<{ x: number; y: number; z: number; durationMs: number } | null>(null);
  const [stats, setStats] = useState({ chunks: 0, triangles: 0 });

  useEffect(() => {
    const host = surface.current;
    if (host == null || !ready) return;
    let renderer: WebGLRenderer | undefined;
    let observer: ResizeObserver | undefined;
    const shadows: DirectionalLight["shadow"][] = [];
    let localLights: ReturnType<typeof createLocalLights> | undefined;
    let cancelled = false;
    let frame = 0;
    let playerTexture: CanvasTexture | undefined;
    let playerMaterial: SpriteMaterial | undefined;
    const geometries: ReturnType<typeof meshChunk>[] = [];
    const material = new MeshLambertMaterial({ vertexColors: true });
    const target = new WebGLRenderTarget(1, 1, { minFilter: NearestFilter, magFilter: NearestFilter });
    target.depthTexture = new DepthTexture(1, 1);
    target.depthTexture.minFilter = NearestFilter;
    target.depthTexture.magFilter = NearestFilter;
    const screenGeometry = new PlaneGeometry(2, 2);
    const screenMaterial = new ShaderMaterial({
      uniforms: { worldTexture: { value: target.texture }, worldDepth: { value: target.depthTexture },
        depthOfField: { value: false }, blurStrength: { value: 3 }, focusRange: { value: 6 },
        focusDepth: { value: 1 }, cameraNear: { value: 0.1 }, cameraFar: { value: 1 }, saturation: { value: 1 }, palette: { value: false }, skyColor: { value: new Color() }, night: { value: 0 }, hour: { value: 16 }, renderSize: { value: [1, 1] } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: LOOK_FRAGMENT,
      depthTest: false, depthWrite: false,
    });
    const dispose = () => {
      cancelAnimationFrame(frame);
      resetPlayer.current = null;
      playerTexture?.dispose();
      playerMaterial?.dispose();
      target.dispose();
      screenGeometry.dispose();
      screenMaterial.dispose();
      for (const shadow of shadows) shadow.dispose();
      localLights?.dispose();
      observer?.disconnect();
      updateView.current = null;
      for (const geometry of geometries) geometry.dispose();
      material.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer?.domElement.remove();
    };
    async function start(host: HTMLDivElement) {
      const { createMeadowHouseWorld } = await import("@evermore/world");
      if (cancelled) return;
      setError("");
      renderer = new WebGLRenderer({ antialias: false, alpha: true });
      renderer.setPixelRatio(1);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = PCFShadowMap;
      renderer.shadowMap.autoUpdate = false;
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.setAttribute("aria-label", `Orthographic ${shadow ? "shadow" : "normal"} world${heatmap ? " with danger heatmap" : ""}`);
      renderer.domElement.setAttribute("role", "img");
      host.appendChild(renderer.domElement);
      const scene = new Scene();
      // Transparent target pixels receive the pixel-grid sky in the screen pass.
      renderer.setClearColor(0x000000, 0);
      const ambient = new AmbientLight(0xc5d9e0, DEFAULT_LOOK.ambient);
      scene.add(ambient);
      const sunlight = new DirectionalLight(0xffd5a0, DEFAULT_LOOK.sunlight);
      shadows.push(sunlight.shadow);
      sunlight.castShadow = true;
      sunlight.shadow.mapSize.set(2048, 2048);
      sunlight.shadow.bias = -0.0003;
      sunlight.shadow.normalBias = 0.08;
      sunlight.position.set(-60, -40, 100);
      scene.add(sunlight);
      const moonlight = new DirectionalLight(0x9cbcff, DEFAULT_LIGHTING.moonlight);
      moonlight.castShadow = true;
      moonlight.shadow.mapSize.set(1024, 1024);
      moonlight.shadow.bias = sunlight.shadow.bias;
      moonlight.shadow.normalBias = sunlight.shadow.normalBias;
      shadows.push(moonlight.shadow);
      scene.add(moonlight);
      if (worldIndex === -1 && !shadow) {
        localLights = createLocalLights();
        scene.add(localLights.group);
      }
      const generatedAt = performance.now();
      const source = imported ? generateWorld(imported.specification, worldSeed) : worldIndex === -1 ? createMeadowHouseWorld() : generateWorld(WORLD_EXAMPLES[worldIndex]!, worldSeed);
      const durationMs = performance.now() - generatedAt;
      setGenerationMs(durationMs);
      setWorldStart({ ...source.spawn, durationMs });
      const state = createMovement({ ...source.spawn, x: source.spawn.x + 0.5, y: source.spawn.y + 0.5 });
      const spriteCanvas = document.createElement("canvas");
      spriteCanvas.width = 16;
      spriteCanvas.height = 32;
      const spriteContext = spriteCanvas.getContext("2d");
      if (!spriteContext) throw new Error("Sprite canvas unavailable");
      playerTexture = new CanvasTexture(spriteCanvas);
      playerTexture.minFilter = NearestFilter;
      playerTexture.magFilter = NearestFilter;
      // AlwaysDepth preserves the navigation overlay while writing player depth.
      // Discard transparent texels so their empty rectangle cannot erase world depth.
      playerMaterial = new SpriteMaterial({ map: playerTexture, depthTest: true, depthFunc: AlwaysDepth, depthWrite: true, alphaTest: 0.5, toneMapped: false });
      const player = new Sprite(playerMaterial);
      player.center.set(0.5, 0.125);
      player.scale.set(1.6, 3.2, 1);
      player.renderOrder = 10;
      scene.add(player);
      const followed = new Vector3(state.x, -state.y, state.z);
      let lastSprite = "";
      const updateSprite = () => {
        const rectangles = movementSprite(state);
        const signature = JSON.stringify(rectangles);
        if (signature === lastSprite) return;
        lastSprite = signature;
        spriteContext.clearRect(0, 0, 16, 32);
        for (const rectangle of rectangles) {
          spriteContext.fillStyle = `#${rectangle.color.toString(16).padStart(6, "0")}`;
          spriteContext.fillRect(8 + rectangle.x, 28 + rectangle.y, rectangle.width, rectangle.height);
        }
        playerTexture!.needsUpdate = true;
      };
      const origin = findInfluenceOrigin(source);
      const radius = Math.hypot(source.width, source.depth) / 2;
      const world = shadow ? deriveShadowWorld(source) : source;
      const collision = (position: typeof source.spawn) => voxelMovementFloor(world, position);
      const dangerColor = heatmap ? (x: number, y: number, z: number, base: number) => {
        const influence = influenceAt({ x, y, z }, origin, radius);
        const tint = new Color(0x246ccc).lerp(new Color(0xff3824), influence);
        return new Color(base).lerp(tint, 0.8).getHex();
      } : undefined;
      const terrain = new Group();
      let triangles = 0;
      for (const chunk of world.chunks()) {
        const geometry = meshChunk(world, chunk, dangerColor);
        geometries.push(geometry);
        if (geometry.getAttribute("position").count === 0) continue;
        triangles += (geometry.index?.count ?? 0) / 3;
        const mesh = new Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        terrain.add(mesh);
      }
      scene.add(terrain);
      const bounds = new Box3().setFromObject(terrain);
      const center = bounds.getCenter(new Vector3());
      sunlight.target.position.copy(center);
      scene.add(sunlight.target);
      moonlight.target.position.copy(center);
      scene.add(moonlight.target);
      const extent = bounds.getSize(new Vector3()).length() / 2;
      Object.assign(sunlight.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 0.1, far: 300 });
      sunlight.shadow.camera.updateProjectionMatrix();
      Object.assign(moonlight.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 0.1, far: 300 });
      moonlight.shadow.camera.updateProjectionMatrix();
      const screen = new Scene();
      const screenQuad = new Mesh(screenGeometry, screenMaterial);
      // This pass writes clip-space positions and must ignore world-camera culling.
      screenQuad.frustumCulled = false;
      screen.add(screenQuad);
      const camera = new OrthographicCamera();
      const screenCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const activeRenderer = renderer;
      let lastWidth = 0;
      let lastHeight = 0;
      let shadowSignature = "";
      let sampleStart = performance.now();
      let sampleFrames = 0;
      let sampleRenderMs = 0;
      const render = (cameraSettings: CameraSettings, lookSettings: LookSettings, lightingSettings: LightingSettings) => {
        const renderStart = performance.now();
        const { width, height } = host.getBoundingClientRect();
        if (width <= 0 || height <= 0) return;
        if (width !== lastWidth || height !== lastHeight) {
          activeRenderer.setSize(width, height, false);
          lastWidth = width;
          lastHeight = height;
        }
        fitCamera(camera, bounds, width / height, cameraSettings);
        camera.position.add(followed.clone().sub(center));
        camera.updateMatrixWorld(true);
        const size = renderDimensions(width, height, lookSettings);
        updateSprite();
        // Snap only the rendered screen position; simulation retains sub-pixels.
        const projected = new Vector3(state.x, -state.y, state.z).project(camera);
        projected.x = Math.round((projected.x + 1) * size.width / 2) * 2 / size.width - 1;
        projected.y = Math.round((projected.y + 1) * size.height / 2) * 2 / size.height - 1;
        player.position.copy(projected.unproject(camera));
        const focusDepth = playerFocusDepth(player.position, camera);
        screenMaterial.uniforms.focusDepth!.value = focusDepth;
        screenMaterial.uniforms.cameraNear!.value = camera.near;
        screenMaterial.uniforms.cameraFar!.value = camera.far;
        screenMaterial.uniforms.depthOfField!.value = lookSettings.depthOfField;
        screenMaterial.uniforms.blurStrength!.value = lookSettings.blurStrength;
        screenMaterial.uniforms.focusRange!.value = lookSettings.focusRange;
        host.dataset.focusDepth = focusDepth.toFixed(4);
        host.dataset.playerX = state.x.toFixed(3);
        host.dataset.playerY = state.y.toFixed(3);
        host.dataset.playerZ = String(state.z);
        target.setSize(size.width, size.height);
        const day = daylightAt(lightingSettings.hour);
        ambient.intensity = lookSettings.ambient * (0.16 + day.day * 0.84);
        ambient.color.copy(day.ambientColor);
        sunlight.intensity = lookSettings.sunlight * day.sun;
        sunlight.color.copy(day.sunColor);
        sunlight.position.copy(center).addScaledVector(day.direction, 120);
        moonlight.position.copy(center).addScaledVector(day.moonDirection, 120);
        moonlight.intensity = lightingSettings.moonlight * day.moon;
        moonlight.castShadow = lookSettings.shadows && day.moon > 0;
        moonlight.shadow.radius = lookSettings.softness;
        localLights?.update(lightingSettings, lookSettings, animationSeconds.current);
        screenMaterial.uniforms.skyColor!.value = day.sky;
        screenMaterial.uniforms.night!.value = 1 - day.day;
        screenMaterial.uniforms.hour!.value = day.hour;
        screenMaterial.uniforms.renderSize!.value = [size.width, size.height];
        sunlight.castShadow = lookSettings.shadows && day.sun > 0;
        sunlight.shadow.radius = lookSettings.softness;
        const nextShadowSignature = JSON.stringify({ lightingSettings, lookSettings, flickerFrame: lightingSettings.flicker ? Math.floor(animationSeconds.current * 30) : 0 });
        activeRenderer.shadowMap.needsUpdate = nextShadowSignature !== shadowSignature;
        shadowSignature = nextShadowSignature;
        screenMaterial.uniforms.saturation!.value = lookSettings.saturation;
        screenMaterial.uniforms.palette!.value = lookSettings.palette;
        activeRenderer.setRenderTarget(target);
        activeRenderer.render(scene, camera);
        const calls = activeRenderer.info.render.calls;
        activeRenderer.setRenderTarget(null);
        activeRenderer.render(screen, screenCamera);
        sampleFrames++;
        sampleRenderMs += performance.now() - renderStart;
        if (performance.now() - sampleStart >= 1000) {
          setPerformanceStats({ fps: sampleFrames * 1000 / (performance.now() - sampleStart), frameMs: sampleRenderMs / sampleFrames, calls: calls + activeRenderer.info.render.calls });
          sampleFrames = 0;
          sampleRenderMs = 0;
          sampleStart = performance.now();
        }
      };
      const contextLost = (event: Event) => {
        if (cancelled) return;
        event.preventDefault();
        setError("WebGL context lost. Reload this page to restart the renderer.");
      };
      renderer.domElement.addEventListener("webglcontextlost", contextLost);
      updateView.current = render;
      const reset = () => {
        keys.current.clear();
        Object.assign(state, createMovement({ ...source.spawn, x: source.spawn.x + 0.5, y: source.spawn.y + 0.5 }));
        followed.set(state.x, -state.y, state.z);
        setPlayerPosition({ x: state.x, y: state.y, z: state.z });
        render(currentSettings.current, currentLook.current, currentLighting.current);
      };
      resetPlayer.current = reset;
      setPlayerPosition({ x: state.x, y: state.y, z: state.z });
      const clock = createMovementClock();
      let previous = performance.now();
      let lastHud = previous;
      let lastFlameRender = previous;
      const destination = new Vector3();
      const tick = (now: number) => {
        const elapsed = document.hidden ? 0 : Math.min((now - previous) / 1000, 0.25);
        previous = now;
        if (elapsed > 0) {
          clock(elapsed, () => stepMovement(state, cameraMovement(movementFromKeys(keys.current), currentSettings.current.rotation), currentMovement.current, collision));
          destination.set(state.x, -state.y, state.z);
          const cameraMoving = followed.distanceToSquared(destination) > 0.000001;
          followed.lerp(destination, followBlend(currentFollow.current, elapsed));
          animationSeconds.current += elapsed;
          let light = currentLighting.current;
          if (light.play) {
            light = { ...light, hour: advanceHour(light.hour, elapsed, light.minutesPerSecond) };
            currentLighting.current = light;
          }
          const flames = light.localLights && light.flicker && light.flickerStrength > 0 && light.flickerSpeed > 0 && worldIndex === -1 && !shadow;
          if (state.moving || cameraMoving || light.play || (flames && now - lastFlameRender >= 1000 / 30)) {
            lastFlameRender = now;
            render(currentSettings.current, currentLook.current, light);
          }
          if (now - lastHud >= 100) {
            lastHud = now;
            setPlayerPosition((old) => old.x === state.x && old.y === state.y && old.z === state.z ? old : { x: state.x, y: state.y, z: state.z });
            if (light.play) setLighting(light);
          }
        }
        if (!cancelled) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      observer = new ResizeObserver(() => render(currentSettings.current, currentLook.current, currentLighting.current));
      observer.observe(host);
      render(currentSettings.current, currentLook.current, currentLighting.current);
      setStats({ chunks: terrain.children.length, triangles });
    }
    void start(host).catch(() => {
      dispose();
      if (!cancelled) setError("The renderer could not start. Enable WebGL and reload this page.");
    });
    return () => { cancelled = true; dispose(); };
  }, [worldIndex, imported, worldSeed, generationRevision, ready, shadow, heatmap, keys]);

  useEffect(() => {
    currentMovement.current = movement;
    currentFollow.current = follow;
    currentSettings.current = settings;
    currentLook.current = look;
    currentLighting.current = lighting;
    updateView.current?.(settings, look, lighting);
  }, [settings, look, lighting, movement, follow]);

  const json = JSON.stringify({ experiment: "r1-voxel", world: worldName, shadow, heatmap, seed: worldSeed, camera: settings, look, lighting, movement, cameraFollow: follow }, null, 2);
  return (
    <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(150px,28%)] gap-2 rounded bg-ink">
      <div ref={surface} tabIndex={0} role="application" aria-label="Voxel world movement" aria-describedby="voxel-controls"
        onPointerDown={() => surface.current?.focus({ preventScroll: true })}
        className="h-[75vh] min-h-[360px] w-full overflow-hidden rounded border border-dusk focus-visible:outline-2 focus-visible:outline-gold" />
      <aside aria-label="Voxel experiment settings" className="grid min-w-0 break-words max-h-[75vh] min-h-[360px] content-start gap-4 overflow-y-auto rounded border border-dusk p-2 text-sm">
        {ready && <GenerationPanel key={JSON.stringify(handoff)} initialIndex={worldIndex} initialSeed={worldSeed} handoff={handoff} onGenerate={(index, seed) => {
          keys.current.clear();
          setSelectedWorld((previous) => ({ index, seed, revision: (previous?.revision ?? 0) + 1 }));
        }} />}
        <p aria-label="Active generation">{worldName} · Seed {worldSeed} · {generationMs.toFixed(1)} ms generation</p>
        <p id="voxel-controls">Click the world, then use WASD / arrow keys. Tab returns to settings. Follow the path to the bridge, or enter the house and take the stairs along the north wall of the kitchen.</p>
      <p className="text-sm text-mist">Seed {worldSeed} · {stats.chunks} chunk meshes · {stats.triangles.toLocaleString()} triangles · {performanceStats.fps.toFixed(1)} fps · {performanceStats.frameMs.toFixed(1)} ms render · {performanceStats.calls} draw calls</p>
        {worldStart && <p aria-label="World start">Wake at {imported?.specification.sleepingPlace?.name ?? "world spawn"} · Start {worldStart.x}, {worldStart.y}, {worldStart.z} · World generation {worldStart.durationMs.toFixed(1)} ms</p>}
        <p aria-label="Player position">Player: {playerPosition.x.toFixed(2)}, {playerPosition.y.toFixed(2)} · Floor {playerPosition.z}</p>
        <fieldset className="min-w-0 grid gap-3 border border-dusk p-3">
          <legend>Movement & follow</legend>
          <MovementSettings value={movement} onChange={setMovement} />
          <label>Camera follow ({follow} /s)<input aria-label="Camera follow" className="w-full max-w-full" type="range" min={1} max={30} step={1} value={follow} onChange={(event) => setFollow(Number(event.target.value))} /></label>
          <button type="button" className="rounded border border-gold px-3 py-1" onClick={() => resetPlayer.current?.()}>Reset player</button>
        </fieldset>
        <fieldset className="min-w-0 grid gap-3 border border-dusk p-3">
          <legend>Depth of field</legend>
          <label><input type="checkbox" checked={look.depthOfField} onChange={(event) => setLook({ ...look, depthOfField: event.target.checked })} /> Depth of field</label>
          <label>Blur strength ({look.blurStrength} render pixels)<input aria-label="Blur strength" className="w-full max-w-full" type="range" min={0} max={6} step={1} value={look.blurStrength} onChange={(event) => setLook({ ...look, blurStrength: Number(event.target.value) })} /></label>
          <label>Focus range (±{look.focusRange} world cells)<input aria-label="Focus range" className="w-full max-w-full" type="range" min={0.5} max={30} step={0.5} value={look.focusRange} onChange={(event) => setLook({ ...look, focusRange: Number(event.target.value) })} /></label>
          <p>The sharp depth band follows the player. Nearer and farther terrain softens in whole render-pixel steps; try a wide view for a miniature effect. Top-down views separate heights rather than north and south.</p>
        </fieldset>
        <fieldset className="min-w-0 flex flex-wrap gap-4 border border-dusk p-3">
          <legend>Firelight flicker</legend>
          <label><input type="checkbox" checked={lighting.flicker} onChange={(event) => setLighting({ ...lighting, flicker: event.target.checked })} /> Flicker</label>
          <label>Strength ({lighting.flickerStrength.toFixed(2)})<input aria-label="Flicker strength" type="range" min={0} max={0.4} step={0.01} value={lighting.flickerStrength} onChange={(event) => setLighting({ ...lighting, flickerStrength: Number(event.target.value) })} /></label>
          <label>Speed ({lighting.flickerSpeed.toFixed(1)}×)<input aria-label="Flicker speed" type="range" min={0} max={6} step={0.1} value={lighting.flickerSpeed} onChange={(event) => setLighting({ ...lighting, flickerSpeed: Number(event.target.value) })} /></label>
          <span className="text-sm">Fire only · lanterns and windows stay steady</span>
        </fieldset>
        <fieldset className="min-w-0 flex flex-wrap items-center gap-4 border border-dusk p-3">
          <legend>World & danger</legend>
          {([false, true] as const).map((value) => <button key={String(value)} type="button" className="rounded border border-gold px-3 py-1" aria-pressed={shadow === value} onClick={() => setShadow(value)}>{value ? "Shadow" : "Normal"}</button>)}
          <label><input type="checkbox" checked={heatmap} onChange={(event) => setHeatmap(event.target.checked)} /> Danger heatmap</label>
          <p className="text-sm">Blue: low danger · Red: high danger. Influence peaks at the first bed (or spawn), fading with horizontal distance.</p>
        </fieldset>
        {importError.length > 0 && <p role="alert">{importError}</p>}
        {error !== "" && <p role="alert">{error}</p>}
        <fieldset className="min-w-0 flex flex-wrap gap-5 rounded border border-dusk p-4">
          <legend className="px-2">Camera settings</legend>
          <div className="flex w-full flex-wrap gap-2" role="group" aria-label="Camera presets">
            {CAMERA_PRESETS.map((preset, index) => (
              <button key={preset.label} type="button"
                className="rounded border border-gold px-3 py-1"
                aria-pressed={settings.inclination === preset.settings.inclination && settings.rotation === preset.settings.rotation}
                onClick={() => setSettings({ ...preset.settings, zoom: settings.zoom })}>
                {preset.label}{index === 0 ? " (default)" : ""}
              </button>
            ))}
          </div>
          <label>Inclination ({settings.inclination}°)
            <input aria-label="Camera inclination" className="w-full max-w-full" type="range" min={0} max={90} step={1} value={settings.inclination} onChange={(event) => setSettings({ ...settings, inclination: Number(event.target.value) })} />
          </label>
          <label>Rotation ({settings.rotation}°)
            <input aria-label="Camera rotation" className="w-full max-w-full" type="range" min={-180} max={180} step={1} value={settings.rotation} onChange={(event) => setSettings({ ...settings, rotation: Number(event.target.value) })} />
          </label>
          <label>Zoom ({settings.zoom.toFixed(2)}×)
            <input aria-label="Camera zoom" className="w-full max-w-full" type="range" min={0.5} max={8} step={0.05} value={settings.zoom} onChange={(event) => setSettings({ ...settings, zoom: Number(event.target.value) })} />
          </label>
          <button className="rounded border border-gold px-3 py-1" type="button" onClick={() => setSettings({ ...settings, zoom: 1 })}>Wide view</button>
          <button className="rounded border border-gold px-3 py-1" type="button" onClick={() => setSettings(PLAYER_CAMERA)}>Reset camera</button>
        </fieldset>
        <p className="text-sm text-mist">Inclination is measured above the horizon. Rotation 0° looks from the south. Zoom 1× uses the world-sized frame around the player; higher zoom gives a closer look.</p>
        <fieldset className="min-w-0 flex flex-wrap gap-5 rounded border border-dusk p-4">
          <legend className="px-2">Day, night & local lights</legend>
          <div className="flex w-full flex-wrap gap-2" role="group" aria-label="Time presets">
            {([["Day", 12], ["Evening", 18], ["Night", 0]] as const).map(([label, hour]) => (
              <button key={label} type="button" className="rounded border border-gold px-3 py-1" aria-pressed={lighting.hour === hour && !lighting.play} onClick={() => setLighting({ ...lighting, hour, play: false })}>{label}</button>
            ))}
            <button type="button" className="rounded border border-gold px-3 py-1" aria-pressed={lighting.play} onClick={() => setLighting({ ...lighting, play: !lighting.play })}>{lighting.play ? "Pause time-lapse" : "Play time-lapse"}</button>
          </div>
          <label>Time of day ({clockLabel(lighting.hour)})<input className="w-full max-w-full" aria-label="Time of day" type="range" min={0} max={24} step={0.05} value={lighting.hour} onChange={(event) => setLighting({ ...lighting, hour: Number(event.target.value), play: false })} /></label>
          {([
            ["radius", "Light radius multiplier", 0.5, 3, 0.1],
            ["intensity", "Local light intensity", 0, 100, 1],
            ["temperature", "Local colour temperature (K)", 1800, 8000, 100],
            ["moonlight", "Moonlight", 0, 3, 0.1],
            ["minutesPerSecond", "Time-lapse minutes per second", 5, 120, 5],
          ] as const).map(([key, label, min, max, step]) => (
            <label key={key}>{label} ({lighting[key]})<input className="w-full max-w-full" aria-label={label} type="range" min={min} max={max} step={step} value={lighting[key]} onChange={(event) => setLighting({ ...lighting, [key]: Number(event.target.value) })} /></label>
          ))}
          <label><input type="checkbox" checked={lighting.localLights} onChange={(event) => setLighting({ ...lighting, localLights: event.target.checked })} /> Local lights</label>
          <button type="button" className="rounded border border-gold px-3 py-1" onClick={() => setLighting(DEFAULT_LIGHTING)}>Reset lighting</button>
        </fieldset>
        <p className="text-sm text-mist">Sunrise at 06:00, sunset at 18:00. Sun and moon move in opposite arcs, changing shadow direction and length. At night, compare warm windows, the two lanterns and the garden fire against cool moonlight. The indoor hearth stays behind the roof in this exterior view.</p>
        <fieldset className="min-w-0 flex flex-wrap gap-5 rounded border border-dusk p-4">
          <legend className="px-2">Pixel look & lighting</legend>
          {([
            ["resolution", "Maximum render width", 320, 1280, 40],
            ["pixelSize", "Minimum pixel size", 1, 6, 1],
            ["ambient", "Ambient light", 0, 3, 0.1],
            ["sunlight", "Warm sunlight", 0, 5, 0.1],
            ["softness", "Shadow softness", 0, 6, 0.5],
            ["saturation", "Colour saturation", 0, 2, 0.05],
          ] as const).map(([key, label, min, max, step]) => (
            <label key={key}>{label} ({look[key]})<input className="w-full max-w-full" aria-label={label} type="range" min={min} max={max} step={step} value={look[key]} onChange={(event) => setLook({ ...look, [key]: Number(event.target.value) })} /></label>
          ))}
          <label><input type="checkbox" checked={look.shadows} onChange={(event) => setLook({ ...look, shadows: event.target.checked })} /> Cast shadows</label>
          <label><input type="checkbox" checked={look.palette} onChange={(event) => setLook({ ...look, palette: event.target.checked })} /> Tonal palette</label>
          <button type="button" className="rounded border border-gold px-3 py-1" onClick={() => setLook(DEFAULT_LOOK)}>Reset look</button>
        </fieldset>
        <p className="text-sm text-mist">The world renders to a low-resolution texture and scales up with nearest filtering. Maximum width and minimum pixel size work together; the finer default keeps roof and foliage detail visible. The optional palette reduces colour tones after lighting.</p>
        <details><summary>Settings JSON</summary>
          <textarea readOnly value={json} rows={12} aria-label="Settings JSON" className="mt-3 w-full rounded bg-black/30 p-3 font-mono text-sm" />
          <button type="button" className="rounded border border-gold px-3 py-1" onClick={() => {
            if (typeof navigator.clipboard === "undefined") { setCopyStatus("Select and copy the JSON above."); return; }
            void navigator.clipboard.writeText(json).then(() => setCopyStatus("Copied settings."), () => setCopyStatus("Select and copy the JSON above."));
          }}>Copy settings</button><p role="status">{copyStatus}</p>
        </details>
      </aside>
    </div>
  );
}
