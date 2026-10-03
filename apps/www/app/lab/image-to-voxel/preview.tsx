"use client";
import { useEffect, useRef, useState } from "react";
import { AmbientLight, Box3, Color, DirectionalLight, Mesh, MeshLambertMaterial, OrthographicCamera, Scene, Vector3, WebGLRenderer, PCFShadowMap } from "three";
import { fitCamera, meshChunk } from "../r1-voxel/voxel-model";
import { daylightAt } from "../r1-voxel/daylight";
import type { Reconstruction } from "./model";

export default function Preview({ result, rotation, hour, sourceColors }: { result: Reconstruction; rotation: number; hour: number; sourceColors: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const render = useRef<((rotation: number, hour: number) => void) | null>(null);
  const current = useRef({ rotation, hour });
  const [error, setError] = useState("");
  useEffect(() => {
    const surface = host.current;
    if (!surface) return;
    let renderer: WebGLRenderer | undefined;
    let observer: ResizeObserver | undefined;
    const geometries: ReturnType<typeof meshChunk>[] = [];
    const material = new MeshLambertMaterial({ vertexColors: true });
    const sun = new DirectionalLight();
    const dispose = () => {
      render.current = null;
      observer?.disconnect();
      geometries.forEach((g) => g.dispose());
      material.dispose();
      sun.shadow.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer?.domElement.remove();
    };
    try {
      renderer = new WebGLRenderer({ antialias: false });
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x141c25);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = PCFShadowMap;
      renderer.domElement.style.cssText = "width:100%;height:100%;display:block;image-rendering:pixelated";
      renderer.domElement.setAttribute("role", "img");
      renderer.domElement.setAttribute("aria-label", "R1 orthographic reconstruction: surface shell with visible facades");
      surface.appendChild(renderer.domElement);
      const scene = new Scene();
      const ambient = new AmbientLight();
      scene.add(ambient, sun, sun.target);
      for (const chunk of result.world.chunks()) {
        const geometry = meshChunk(result.world, chunk);
        geometries.push(geometry);
        if (sourceColors || result.cellColors !== undefined) {
          const positions = geometry.getAttribute("position");
          const colors = geometry.getAttribute("color");
          const normals = geometry.getAttribute("normal");
          for (let i = 0; i < positions.count; i += 4) {
            let x = 0; let y = 0; let z = 0;
            for (let v = i; v < i + 4; v++) { x += positions.getX(v) / 4; y -= positions.getY(v) / 4; z += positions.getZ(v) / 4; }
            x -= normals.getX(i) * 0.001; y += normals.getY(i) * 0.001; z -= normals.getZ(i) * 0.001;
            const col = Math.max(0, Math.min(result.columns - 1, Math.floor(x)));
            const row = Math.max(0, Math.min(result.rows - 1, Math.floor(y)));
            const tone = 0.15 + Math.max(0, Math.floor(z)) / Math.max(1, result.world.height - 4) * 0.75;
            const color = sourceColors
              ? new Color(result.cellColors?.get(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`) ?? result.tiles[col + row * result.columns]!.color)
              : new Color().setRGB(tone, tone, tone);
            for (let v = i; v < i + 4; v++) colors.setXYZ(v, color.r, color.g, color.b);
          }
        }
        const mesh = new Mesh(geometry, material);
        mesh.castShadow = true; mesh.receiveShadow = true;
        scene.add(mesh);
      }
      const bounds = new Box3(new Vector3(0, -result.world.depth, 0), new Vector3(result.columns, 0, result.world.height - 3));
      const center = bounds.getCenter(new Vector3());
      const extent = bounds.getSize(new Vector3()).length();
      sun.target.position.copy(center);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.normalBias = 0.05;
      Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 0.1, far: extent * 4 });
      sun.shadow.camera.updateProjectionMatrix();
      const camera = new OrthographicCamera();
      const active = renderer;
      render.current = (angle, time) => {
        const { width, height } = surface.getBoundingClientRect();
        if (width <= 0 || height <= 0) return;
        active.setSize(Math.min(800, Math.round(width)), Math.round(height * Math.min(800, width) / width), false);
        fitCamera(camera, bounds, width / height, { inclination: 45, rotation: angle, zoom: 1 });
        const light = daylightAt(time);
        ambient.color.copy(light.ambientColor);
        ambient.intensity = 0.4 + light.day * 1.5;
        sun.color.copy(light.sunColor);
        sun.intensity = light.sun * 2.5;
        sun.position.copy(center).addScaledVector(light.direction, extent * 1.5);
        active.render(scene, camera);
      };
      observer = new ResizeObserver(() => render.current?.(current.current.rotation, current.current.hour));
      observer.observe(surface);
      render.current(current.current.rotation, current.current.hour);
    } catch { dispose(); queueMicrotask(() => setError("Could not start WebGL. Enable WebGL and reload to preview; world export remains available.")); }
    return dispose;
  }, [result, sourceColors]);
  useEffect(() => { current.current = { rotation, hour }; render.current?.(rotation, hour); }, [rotation, hour]);
  return <><div ref={host} className="h-full min-h-64 w-full" />{error !== "" && <p role="alert">{error}</p>}</>;
}
