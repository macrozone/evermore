"use client";

import { MEADOW_HOUSE_SEED } from "@evermore/world";
import { useEffect, useRef, useState } from "react";
import { AmbientLight, Box3, Color, DirectionalLight, Group, Mesh, MeshLambertMaterial, OrthographicCamera, Scene, WebGLRenderer, WebGLRenderTarget, NearestFilter, ShaderMaterial, PlaneGeometry, PCFShadowMap, Vector3 } from "three";
import { CAMERA_PRESETS, DEFAULT_CAMERA, fitCamera, meshChunk, type CameraSettings } from "./voxel-model";

import { addSurfaceTextures, createSurfaceAtlas } from "./voxel-textures";

import { DEFAULT_LOOK, LOOK_FRAGMENT, renderDimensions, type LookSettings } from "./pixel-look";

export default function VoxelExperiment() {
  const surface = useRef<HTMLDivElement>(null);
  const updateView = useRef<((settings: CameraSettings, look: LookSettings) => void) | null>(null);
  const currentSettings = useRef(DEFAULT_CAMERA);
  const currentLook = useRef(DEFAULT_LOOK);
  const [look, setLook] = useState(DEFAULT_LOOK);
  const [settings, setSettings] = useState(DEFAULT_CAMERA);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [stats, setStats] = useState({ chunks: 0, triangles: 0, meshMs: 0, width: 0, height: 0 });
  const [benchmark, setBenchmark] = useState(false);
  const [performanceStats, setPerformanceStats] = useState<{ fps: number; renderMs: number } | null>(null);
  const benchmarkActive = useRef(false);

  useEffect(() => {
    const host = surface.current;
    if (host == null) return;
    let renderer: WebGLRenderer | undefined;
    let observer: ResizeObserver | undefined;
    let shadow: DirectionalLight["shadow"] | undefined;
    let cancelled = false;
    const geometries: ReturnType<typeof meshChunk>[] = [];
    const material = new MeshLambertMaterial({ vertexColors: true });
    const atlas = createSurfaceAtlas();
    const textureUniforms = addSurfaceTextures(material, atlas);
    let frame = 0;
    const target = new WebGLRenderTarget(1, 1, { minFilter: NearestFilter, magFilter: NearestFilter });
    const screenGeometry = new PlaneGeometry(2, 2);
    const screenMaterial = new ShaderMaterial({
      uniforms: { worldTexture: { value: target.texture }, saturation: { value: 1 }, palette: { value: false } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: LOOK_FRAGMENT,
      depthTest: false, depthWrite: false,
    });
    const dispose = () => {
      cancelAnimationFrame(frame);
      atlas.dispose();
      target.dispose();
      screenGeometry.dispose();
      screenMaterial.dispose();
      shadow?.dispose();
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
      renderer = new WebGLRenderer({ antialias: false });
      renderer.setPixelRatio(1);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.type = PCFShadowMap;
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.setAttribute("aria-label", "Orthographic view of the meadow-house voxel world");
      renderer.domElement.setAttribute("role", "img");
      host.appendChild(renderer.domElement);
      const scene = new Scene();
      scene.background = new Color(0x263b35);
      const ambient = new AmbientLight(0xc5d9e0, DEFAULT_LOOK.ambient);
      scene.add(ambient);
      const sunlight = new DirectionalLight(0xffd5a0, DEFAULT_LOOK.sunlight);
      shadow = sunlight.shadow;
      sunlight.castShadow = true;
      sunlight.shadow.mapSize.set(2048, 2048);
      sunlight.shadow.bias = -0.0003;
      sunlight.shadow.normalBias = 0.08;
      sunlight.position.set(-60, -40, 100);
      scene.add(sunlight);
      const world = createMeadowHouseWorld();
      const terrain = new Group();
      let activeFineness = 0;
      const rebuild = (fineness: LookSettings["fineness"]) => {
        const start = performance.now();
        terrain.clear();
        for (const geometry of geometries) geometry.dispose();
        geometries.length = 0;
        let triangles = 0;
        for (const chunk of world.chunks()) {
          const geometry = meshChunk(world, chunk, fineness);
          geometries.push(geometry);
          if (geometry.getAttribute("position").count === 0) continue;
          triangles += (geometry.index?.count ?? 0) / 3;
          const mesh = new Mesh(geometry, material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          terrain.add(mesh);
        }
        activeFineness = fineness;
        setStats((stats) => ({ ...stats, chunks: terrain.children.length, triangles, meshMs: performance.now() - start }));
      };
      rebuild(currentLook.current.fineness);
      scene.add(terrain);
      const bounds = new Box3().setFromObject(terrain);
      const homeBounds = new Box3(new Vector3(3, -56, 3), new Vector3(43, -27, 14));
      const center = bounds.getCenter(new Vector3());
      sunlight.target.position.copy(center);
      scene.add(sunlight.target);
      sunlight.position.add(center);
      const extent = bounds.getSize(new Vector3()).length() / 2;
      Object.assign(sunlight.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 0.1, far: 300 });
      sunlight.shadow.camera.updateProjectionMatrix();
      const screen = new Scene();
      const screenQuad = new Mesh(screenGeometry, screenMaterial);
      // This shader writes clip-space coordinates; world-camera culling does
      // not apply, especially when the camera frames a small part of the map.
      screenQuad.frustumCulled = false;
      screen.add(screenQuad);
      const camera = new OrthographicCamera();
      const activeRenderer = renderer;
      let shadowKey = "";
      const render = (cameraSettings: CameraSettings, lookSettings: LookSettings) => {
        const { width, height } = host.getBoundingClientRect();
        if (width <= 0 || height <= 0) return;
        if (activeFineness !== lookSettings.fineness) rebuild(lookSettings.fineness);
        activeRenderer.setSize(width, height, false);
        fitCamera(camera, cameraSettings.focus === "home" ? homeBounds : bounds, width / height, cameraSettings);
        const size = renderDimensions(width, height, lookSettings);
        target.setSize(size.width, size.height);
        setStats((stats) => stats.width === size.width && stats.height === size.height ? stats : { ...stats, width: size.width, height: size.height });
        textureUniforms.surfaceTextures.value = lookSettings.textures;
        ambient.intensity = lookSettings.ambient;
        sunlight.intensity = lookSettings.sunlight;
        sunlight.castShadow = lookSettings.shadows;
        sunlight.shadow.radius = lookSettings.softness;
        const nextShadowKey = `${lookSettings.fineness}:${lookSettings.shadows}:${lookSettings.softness}`;
        activeRenderer.shadowMap.needsUpdate = nextShadowKey !== shadowKey;
        shadowKey = nextShadowKey;
        screenMaterial.uniforms.saturation!.value = lookSettings.saturation;
        screenMaterial.uniforms.palette!.value = lookSettings.palette;
        activeRenderer.setRenderTarget(target);
        activeRenderer.render(scene, camera);
        activeRenderer.setRenderTarget(null);
        activeRenderer.render(screen, camera);
      };
      const contextLost = (event: Event) => {
        event.preventDefault();
        setError("WebGL context lost. Reload this page to restart the renderer.");
      };
      renderer.domElement.addEventListener("webglcontextlost", contextLost);
      updateView.current = render;
      observer = new ResizeObserver(() => render(currentSettings.current, currentLook.current));
      observer.observe(host);
      render(currentSettings.current, currentLook.current);
      let sampleStart = performance.now(), frames = 0, renderTime = 0;
      const tick = () => {
        if (cancelled) return;
        if (benchmarkActive.current) {
          const start = performance.now();
          render(currentSettings.current, currentLook.current);
          renderTime += performance.now() - start;
          frames++;
          const elapsed = performance.now() - sampleStart;
          if (elapsed >= 1000) {
            setPerformanceStats({ fps: frames * 1000 / elapsed, renderMs: renderTime / frames });
            sampleStart = performance.now(); frames = 0; renderTime = 0;
          }
        } else { sampleStart = performance.now(); frames = 0; renderTime = 0; }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }
    void start(host).catch(() => {
      dispose();
      if (!cancelled) setError("The renderer could not start. Enable WebGL and reload this page.");
    });
    return () => { cancelled = true; dispose(); };
  }, []);

  useEffect(() => {
    currentSettings.current = settings;
    currentLook.current = look;
    updateView.current?.(settings, look);
  }, [settings, look]);

  useEffect(() => { benchmarkActive.current = benchmark; }, [benchmark]);

  const json = JSON.stringify({ experiment: "r1-voxel", world: "meadow-house", seed: MEADOW_HOUSE_SEED, camera: settings, look }, null, 2);
  return (
    <div className="grid gap-5">
      <div ref={surface} className="aspect-[4/3] w-full overflow-hidden rounded border border-dusk sm:aspect-video" />
      {error !== "" && <p role="alert">{error}</p>}
      <p className="text-sm text-mist">Seed {MEADOW_HOUSE_SEED} · {stats.chunks} chunk meshes · {stats.triangles.toLocaleString()} triangles · {stats.width} × {stats.height} render pixels · meshed in {stats.meshMs.toFixed(0)} ms</p>
      <div className="flex flex-wrap items-center gap-3 text-sm text-mist">
        <button type="button" className="rounded border border-gold px-3 py-1" aria-pressed={benchmark} onClick={() => { setBenchmark(!benchmark); setPerformanceStats(null); }}>{benchmark ? "Stop FPS benchmark" : "Run FPS benchmark"}</button>
        <span role="status">{benchmark ? performanceStats ? `${performanceStats.fps.toFixed(1)} FPS · ${performanceStats.renderMs.toFixed(1)} ms CPU render submission (vsync capped)` : "Measuring…" : "Rendered on demand; benchmark enables continuous frames."}</span>
      </div>
      <fieldset className="flex flex-wrap gap-5 rounded border border-dusk p-4">
        <legend className="px-2">Camera settings</legend>
        <div className="flex w-full flex-wrap gap-2" role="group" aria-label="Camera presets">
          {CAMERA_PRESETS.map((preset, index) => (
            <button key={preset.label} type="button"
              className="rounded border border-gold px-3 py-1"
              aria-pressed={Object.entries(preset.settings).every(([key, value]) => settings[key as keyof CameraSettings] === value)}
              onClick={() => setSettings({ ...preset.settings })}>
              {preset.label}{index === 0 ? " (default)" : ""}
            </button>
          ))}
        </div>
        <label>Inclination ({settings.inclination}°)
          <input aria-label="Camera inclination" className="ml-2" type="range" min={0} max={90} step={1} value={settings.inclination} onChange={(event) => setSettings({ ...settings, inclination: Number(event.target.value) })} />
        </label>
        <label>Rotation ({settings.rotation}°)
          <input aria-label="Camera rotation" className="ml-2" type="range" min={-180} max={180} step={1} value={settings.rotation} onChange={(event) => setSettings({ ...settings, rotation: Number(event.target.value) })} />
        </label>
        <label>Zoom ({settings.zoom.toFixed(2)}×)
          <input aria-label="Camera zoom" className="ml-2" type="range" min={0.5} max={3} step={0.05} value={settings.zoom} onChange={(event) => setSettings({ ...settings, zoom: Number(event.target.value) })} />
        </label>
        <button className="rounded border border-gold px-3 py-1" type="button" onClick={() => setSettings({ ...settings, zoom: 1, focus: "world" })}>Fit whole world</button>
        <button className="rounded border border-gold px-3 py-1" type="button" onClick={() => setSettings(DEFAULT_CAMERA)}>Reset camera</button>
      </fieldset>
      <p className="text-sm text-mist">Inclination is measured above the horizon. Rotation 0° looks from the south. The default 2D look frames the home and garden. Fit whole world shows the entire fixture; higher zoom crops the selected framing.</p>
      <fieldset className="flex flex-wrap gap-5 rounded border border-dusk p-4">
        <legend className="px-2">Pixel look & lighting</legend>
        <label>Voxel fineness
          <select aria-label="Voxel fineness" className="ml-2 rounded bg-dusk p-1" value={look.fineness} onChange={(event) => setLook({ ...look, fineness: Number(event.target.value) as LookSettings["fineness"] })}>
            {[1, 2, 4, 8].map((value) => <option key={value} value={value}>{value}× per axis{value === 1 ? " (original cubes)" : ""}</option>)}
          </select>
        </label>
        <label><input aria-label="Surface textures" type="checkbox" checked={look.textures} onChange={(event) => setLook({ ...look, textures: event.target.checked })} /> Surface textures</label>
        {([
          ["resolution", "Maximum render width", 320, 1920, 40],
          ["pixelSize", "Minimum pixel size", 1, 6, 1],
          ["ambient", "Ambient light", 0, 3, 0.1],
          ["sunlight", "Warm sunlight", 0, 5, 0.1],
          ["softness", "Shadow softness", 0, 6, 0.5],
          ["saturation", "Colour saturation", 0, 2, 0.05],
        ] as const).map(([key, label, min, max, step]) => (
          <label key={key}>{label} ({look[key]})<input className="ml-2" aria-label={label} type="range" min={min} max={max} step={step} value={look[key]} onChange={(event) => setLook({ ...look, [key]: Number(event.target.value) })} /></label>
        ))}
        <label><input type="checkbox" checked={look.shadows} onChange={(event) => setLook({ ...look, shadows: event.target.checked })} /> Cast shadows</label>
        <label><input type="checkbox" checked={look.palette} onChange={(event) => setLook({ ...look, palette: event.target.checked })} /> Tonal palette</label>
        <button type="button" className="rounded border border-gold px-3 py-1" onClick={() => setLook(DEFAULT_LOOK)}>Reset look</button>
      </fieldset>
      <p className="text-sm text-mist">Voxel fineness shapes roofs, foliage, stones, fences and lanterns in smaller steps. Surface textures use one shared pixel density for grass, wood, masonry and water. Maximum render width and minimum pixel size jointly set the actual target shown above; nearest filtering keeps pixels crisp. The optional palette reduces colour tones after lighting.</p>
      <details><summary>Settings JSON</summary>
        <textarea readOnly value={json} rows={12} aria-label="Settings JSON" className="mt-3 w-full rounded bg-black/30 p-3 font-mono text-sm" />
        <button type="button" className="rounded border border-gold px-3 py-1" onClick={() => {
          if (typeof navigator.clipboard === "undefined") { setCopyStatus("Select and copy the JSON above."); return; }
          void navigator.clipboard.writeText(json).then(() => setCopyStatus("Copied settings."), () => setCopyStatus("Select and copy the JSON above."));
        }}>Copy settings</button><p role="status">{copyStatus}</p>
      </details>
    </div>
  );
}
