"use client";

import { RenderStats, useRenderStats } from "../../../components/lab/render-stats";

import { LabViewport } from "../../../components/lab/lab-viewport";

import { MEADOW_HOUSE_SEED } from "@evermore/world";
import { useEffect, useRef, useState } from "react";
import { AmbientLight, Box3, Color, DirectionalLight, Group, Mesh, MeshLambertMaterial, OrthographicCamera, Scene, WebGLRenderer, WebGLRenderTarget, NearestFilter, ShaderMaterial, PlaneGeometry, PCFShadowMap, Vector3 } from "three";
import { CAMERA_PRESETS, DEFAULT_CAMERA, fitCamera, meshChunk, type CameraSettings } from "./voxel-model";

import { advanceHour, clockLabel, daylightAt, DEFAULT_LIGHTING, type LightingSettings } from "./daylight";
import { createLocalLights } from "./local-lights";

import { DEFAULT_LOOK, LOOK_FRAGMENT, renderDimensions, type LookSettings } from "./pixel-look";

export default function VoxelExperiment() {
  const { stats: performanceStats, recordFrame } = useRenderStats();
  const surface = useRef<HTMLDivElement>(null);
  const updateView = useRef<((settings: CameraSettings, look: LookSettings, lighting: LightingSettings) => void) | null>(null);
  const currentSettings = useRef(DEFAULT_CAMERA);
  const currentLook = useRef(DEFAULT_LOOK);
  const currentLighting = useRef(DEFAULT_LIGHTING);
  const [lighting, setLighting] = useState(DEFAULT_LIGHTING);
  const [look, setLook] = useState(DEFAULT_LOOK);
  const [settings, setSettings] = useState(DEFAULT_CAMERA);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [stats, setStats] = useState({ chunks: 0, triangles: 0 });

  useEffect(() => {
    const host = surface.current;
    if (host == null) return;
    let renderer: WebGLRenderer | undefined;
    let observer: ResizeObserver | undefined;
    const shadows: DirectionalLight["shadow"][] = [];
    let localLights: ReturnType<typeof createLocalLights> | undefined;
    let cancelled = false;
    const geometries: ReturnType<typeof meshChunk>[] = [];
    const material = new MeshLambertMaterial({ vertexColors: true });
    const target = new WebGLRenderTarget(1, 1, { minFilter: NearestFilter, magFilter: NearestFilter });
    const screenGeometry = new PlaneGeometry(2, 2);
    const screenMaterial = new ShaderMaterial({
      uniforms: { worldTexture: { value: target.texture }, saturation: { value: 1 }, palette: { value: false }, skyColor: { value: new Color() }, night: { value: 0 }, hour: { value: 16 }, renderSize: { value: [1, 1] } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: LOOK_FRAGMENT,
      depthTest: false, depthWrite: false,
    });
    const dispose = () => {
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
      renderer = new WebGLRenderer({ antialias: false, alpha: true });
      renderer.setPixelRatio(1);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = PCFShadowMap;
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.setAttribute("aria-label", "Orthographic view of the meadow-house voxel world");
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
      localLights = createLocalLights();
      scene.add(localLights.group);
      const world = createMeadowHouseWorld();
      const terrain = new Group();
      let triangles = 0;
      for (const chunk of world.chunks()) {
        const geometry = meshChunk(world, chunk);
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
      screen.add(new Mesh(screenGeometry, screenMaterial));
      const camera = new OrthographicCamera();
      const activeRenderer = renderer;
      let lastWidth = 0;
      let lastHeight = 0;
      const render = (cameraSettings: CameraSettings, lookSettings: LookSettings, lightingSettings: LightingSettings) => {
        const { width, height } = host.getBoundingClientRect();
        if (width <= 0 || height <= 0) return;
        if (width !== lastWidth || height !== lastHeight) {
          activeRenderer.setSize(width, height, false);
          lastWidth = width;
          lastHeight = height;
        }
        fitCamera(camera, bounds, width / height, cameraSettings);
        const size = renderDimensions(width, height, lookSettings);
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
        localLights?.update(lightingSettings, lookSettings);
        screenMaterial.uniforms.skyColor!.value = day.sky;
        screenMaterial.uniforms.night!.value = 1 - day.day;
        screenMaterial.uniforms.hour!.value = day.hour;
        screenMaterial.uniforms.renderSize!.value = [size.width, size.height];
        sunlight.castShadow = lookSettings.shadows && day.sun > 0;
        sunlight.shadow.radius = lookSettings.softness;
        activeRenderer.shadowMap.needsUpdate = true;
        screenMaterial.uniforms.saturation!.value = lookSettings.saturation;
        screenMaterial.uniforms.palette!.value = lookSettings.palette;
        const started = performance.now();
        activeRenderer.info.autoReset = false;
        activeRenderer.info.reset();
        activeRenderer.setRenderTarget(target);
        activeRenderer.render(scene, camera);
        activeRenderer.setRenderTarget(null);
        activeRenderer.render(screen, camera);
        recordFrame(performance.now() - started, activeRenderer.info.render);
      };
      const contextLost = (event: Event) => {
        event.preventDefault();
        setError("WebGL context lost. Reload this page to restart the renderer.");
      };
      renderer.domElement.addEventListener("webglcontextlost", contextLost);
      updateView.current = render;
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
  }, [recordFrame]);

  useEffect(() => {
    currentSettings.current = settings;
    currentLook.current = look;
    currentLighting.current = lighting;
    updateView.current?.(settings, look, lighting);
  }, [settings, look, lighting]);

  useEffect(() => {
    if (!lighting.play) return;
    let frame = 0;
    let previous = performance.now();
    let lastUpdate = previous;
    const tick = (now: number) => {
      // Cap this experiment at 12 updates/s; hidden tabs pause time entirely.
      if (document.hidden) { previous = now; lastUpdate = now; }
      else if (now - lastUpdate >= 1000 / 12) {
        const elapsed = (now - previous) / 1000;
        previous = now;
        lastUpdate = now;
        setLighting((value) => ({ ...value, hour: advanceHour(value.hour, elapsed, value.minutesPerSecond) }));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [lighting.play]);

  const json = JSON.stringify({ experiment: "r1-voxel", world: "meadow-house", seed: MEADOW_HOUSE_SEED, camera: settings, look, lighting }, null, 2);
  return (
    <LabViewport title="R1 · Orthographic voxels" description="The whole meadow-house world: a two-storey house, river and bridge, trees, hill stairs and tower. Adjust the view and copy your camera and lighting settings for comparison." controls={<>
      {error !== "" && <p role="alert">{error}</p>}
      <p className="text-sm text-mist">Seed {MEADOW_HOUSE_SEED} · {stats.chunks} chunk meshes · {stats.triangles.toLocaleString()} triangles · {lighting.play ? "time-lapse at up to 12 fps" : "rendered on demand"}</p>
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
        <button className="rounded border border-gold px-3 py-1" type="button" onClick={() => setSettings({ ...settings, zoom: 1 })}>Fit whole world</button>
        <button className="rounded border border-gold px-3 py-1" type="button" onClick={() => setSettings(DEFAULT_CAMERA)}>Reset camera</button>
      </fieldset>
      <p className="text-sm text-mist">Inclination is measured above the horizon. Rotation 0° looks from the south. Zoom 1× fits the whole world at any angle; higher zoom crops the edges for a closer look.</p>
      <fieldset className="flex flex-wrap gap-5 rounded border border-dusk p-4">
        <legend className="px-2">Day, night & local lights</legend>
        <div className="flex w-full flex-wrap gap-2" role="group" aria-label="Time presets">
          {([["Day", 12], ["Evening", 18], ["Night", 0]] as const).map(([label, hour]) => (
            <button key={label} type="button" className="rounded border border-gold px-3 py-1" aria-pressed={lighting.hour === hour && !lighting.play} onClick={() => setLighting({ ...lighting, hour, play: false })}>{label}</button>
          ))}
          <button type="button" className="rounded border border-gold px-3 py-1" aria-pressed={lighting.play} onClick={() => setLighting({ ...lighting, play: !lighting.play })}>{lighting.play ? "Pause time-lapse" : "Play time-lapse"}</button>
        </div>
        <label>Time of day ({clockLabel(lighting.hour)})<input className="ml-2" aria-label="Time of day" type="range" min={0} max={24} step={0.05} value={lighting.hour} onChange={(event) => setLighting({ ...lighting, hour: Number(event.target.value), play: false })} /></label>
        {([
          ["radius", "Light radius multiplier", 0.5, 3, 0.1],
          ["intensity", "Local light intensity", 0, 100, 1],
          ["temperature", "Local colour temperature (K)", 1800, 8000, 100],
          ["moonlight", "Moonlight", 0, 3, 0.1],
          ["minutesPerSecond", "Time-lapse minutes per second", 5, 120, 5],
        ] as const).map(([key, label, min, max, step]) => (
          <label key={key}>{label} ({lighting[key]})<input className="ml-2" aria-label={label} type="range" min={min} max={max} step={step} value={lighting[key]} onChange={(event) => setLighting({ ...lighting, [key]: Number(event.target.value) })} /></label>
        ))}
        <label><input type="checkbox" checked={lighting.localLights} onChange={(event) => setLighting({ ...lighting, localLights: event.target.checked })} /> Local lights</label>
        <button type="button" className="rounded border border-gold px-3 py-1" onClick={() => setLighting(DEFAULT_LIGHTING)}>Reset lighting</button>
      </fieldset>
      <p className="text-sm text-mist">Sunrise at 06:00, sunset at 18:00. Sun and moon move in opposite arcs, changing shadow direction and length. At night, compare warm windows, the two lanterns and the garden fire against cool moonlight. The indoor hearth stays behind the roof in this exterior view.</p>
      <fieldset className="flex flex-wrap gap-5 rounded border border-dusk p-4">
        <legend className="px-2">Pixel look & lighting</legend>
        {([
          ["resolution", "Maximum render width", 320, 1280, 40],
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
      <p className="text-sm text-mist">The world renders to a low-resolution texture and scales up with nearest filtering. Maximum width and minimum pixel size work together; the finer default keeps roof and foliage detail visible. The optional palette reduces colour tones after lighting.</p>
      <details><summary>Settings JSON</summary>
        <textarea readOnly value={json} rows={12} aria-label="Settings JSON" className="mt-3 w-full rounded bg-black/30 p-3 font-mono text-sm" />
        <button type="button" className="rounded border border-gold px-3 py-1" onClick={() => {
          if (typeof navigator.clipboard === "undefined") { setCopyStatus("Select and copy the JSON above."); return; }
          void navigator.clipboard.writeText(json).then(() => setCopyStatus("Copied settings."), () => setCopyStatus("Select and copy the JSON above."));
        }}>Copy settings</button><p role="status">{copyStatus}</p>
      </details>
      <p className="text-sm text-mist">Pixel rendering study with a moving sun and moon, stars, warm windows, lanterns and a garden fire. Compare day and night, soft shadows and optional tonal colour reduction. Water, glass and foliage are opaque placeholders. Interiors remain under their roofs; player movement and cutaway come in later slices.</p>
    </>}>
      <div ref={surface} className="h-full w-full overflow-hidden" />
      <RenderStats stats={performanceStats} />
    </LabViewport>
  );
}
