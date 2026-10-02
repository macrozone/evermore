"use client";

import { MEADOW_HOUSE_SEED } from "@evermore/world";
import { useEffect, useRef, useState } from "react";
import { AmbientLight, Box3, Color, DirectionalLight, Group, Mesh, MeshLambertMaterial, OrthographicCamera, Scene, WebGLRenderer } from "three";
import { DEFAULT_CAMERA, fitCamera, meshChunk, type CameraSettings } from "./voxel-model";

export default function VoxelExperiment() {
  const surface = useRef<HTMLDivElement>(null);
  const updateView = useRef<((settings: CameraSettings) => void) | null>(null);
  const currentSettings = useRef(DEFAULT_CAMERA);
  const [settings, setSettings] = useState(DEFAULT_CAMERA);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [stats, setStats] = useState({ chunks: 0, triangles: 0 });

  useEffect(() => {
    const host = surface.current;
    if (host == null) return;
    let renderer: WebGLRenderer | undefined;
    let observer: ResizeObserver | undefined;
    let cancelled = false;
    const geometries: ReturnType<typeof meshChunk>[] = [];
    const material = new MeshLambertMaterial({ vertexColors: true });
    const dispose = () => {
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
      renderer = new WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.setAttribute("aria-label", "Orthographic view of the meadow-house voxel world");
      renderer.domElement.setAttribute("role", "img");
      host.appendChild(renderer.domElement);
      const scene = new Scene();
      scene.background = new Color(0x172b26);
      scene.add(new AmbientLight(0xffffff, 1.3));
      const sunlight = new DirectionalLight(0xffffff, 2);
      sunlight.position.set(-60, -40, 100);
      scene.add(sunlight);
      const world = createMeadowHouseWorld();
      const terrain = new Group();
      let triangles = 0;
      for (const chunk of world.chunks()) {
        const geometry = meshChunk(world, chunk);
        geometries.push(geometry);
        if (geometry.getAttribute("position").count === 0) continue;
        triangles += (geometry.index?.count ?? 0) / 3;
        terrain.add(new Mesh(geometry, material));
      }
      scene.add(terrain);
      const bounds = new Box3().setFromObject(terrain);
      const camera = new OrthographicCamera();
      const activeRenderer = renderer;
      const render = (cameraSettings: CameraSettings) => {
        const { width, height } = host.getBoundingClientRect();
        if (width <= 0 || height <= 0) return;
        activeRenderer.setSize(width, height, false);
        fitCamera(camera, bounds, width / height, cameraSettings);
        activeRenderer.render(scene, camera);
      };
      const contextLost = (event: Event) => {
        event.preventDefault();
        setError("WebGL context lost. Reload this page to restart the renderer.");
      };
      renderer.domElement.addEventListener("webglcontextlost", contextLost);
      updateView.current = render;
      observer = new ResizeObserver(() => render(currentSettings.current));
      observer.observe(host);
      render(currentSettings.current);
      setStats({ chunks: terrain.children.length, triangles });
    }
    void start(host).catch(() => {
      dispose();
      if (!cancelled) setError("The renderer could not start. Enable WebGL and reload this page.");
    });
    return () => { cancelled = true; dispose(); };
  }, []);

  useEffect(() => {
    currentSettings.current = settings;
    updateView.current?.(settings);
  }, [settings]);

  const json = JSON.stringify({ experiment: "r1-voxel", world: "meadow-house", seed: MEADOW_HOUSE_SEED, camera: settings }, null, 2);
  return (
    <div className="grid gap-5">
      <div ref={surface} className="aspect-[4/3] w-full overflow-hidden rounded border border-dusk sm:aspect-video" />
      {error !== "" && <p role="alert">{error}</p>}
      <p className="text-sm text-mist">Seed {MEADOW_HOUSE_SEED} · {stats.chunks} chunk meshes · {stats.triangles.toLocaleString()} triangles · rendered on demand</p>
      <fieldset className="flex flex-wrap gap-5 rounded border border-dusk p-4">
        <legend className="px-2">Camera settings</legend>
        <label>Inclination ({settings.inclination}°)
          <input aria-label="Camera inclination" className="ml-2" type="range" min={15} max={80} step={1} value={settings.inclination} onChange={(event) => setSettings({ ...settings, inclination: Number(event.target.value) })} />
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
