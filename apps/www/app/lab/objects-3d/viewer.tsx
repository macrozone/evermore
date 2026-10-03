"use client";
import { useEffect, useRef, useState } from "react";
import { AmbientLight, Box3, DirectionalLight, Mesh, MeshLambertMaterial, OrthographicCamera, PlaneGeometry, Scene, Vector3, WebGLRenderer, Texture, type Object3D } from "three";
import { fitCamera, meshChunk } from "../r1-voxel/voxel-model";
import { shellWorld, type Shell } from "./model";

export function disposeObject(object: Object3D) {
  const textures = new Set<Texture>();
  object.traverse(node => {
    if (!(node instanceof Mesh)) return;
    node.geometry.dispose();
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
      material.dispose();
    }
  });
  textures.forEach(texture => { (texture.image as { close?: () => void } | undefined)?.close?.(); texture.dispose(); });
}

export default function Viewer({ object, shell, angle, spin }: { object?: Object3D; shell?: Shell; angle: number; spin: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const stats = useRef<HTMLOutputElement>(null);
  const settings = useRef({ angle, spin });
  const [error, setError] = useState("");
  useEffect(() => { settings.current = { angle, spin }; }, [angle, spin]);
  useEffect(() => {
    const surface = host.current;
    if (!surface || (!object && !shell)) return;
    let renderer: WebGLRenderer | undefined;
    let frame = 0;
    let observer: ResizeObserver | undefined;
    const owned: Mesh[] = [];
    const scene = new Scene();
    let mounted: Object3D | undefined;
    const light = new DirectionalLight(0xffedca, 2.5);
    const clean = () => {
      cancelAnimationFrame(frame); observer?.disconnect();
      if (mounted) scene.remove(mounted);
      owned.forEach(mesh => { mesh.geometry.dispose(); (mesh.material as MeshLambertMaterial).dispose(); });
      light.shadow.dispose(); renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove();
    };
    try {
      renderer = new WebGLRenderer({ antialias: false });
      renderer.setPixelRatio(1); renderer.setClearColor(0x182126); renderer.shadowMap.enabled = true;
      renderer.domElement.setAttribute("aria-label", shell ? "Voxel surface preview" : "Imported mesh preview");
      renderer.domElement.style.cssText = "width:100%;height:100%;display:block;image-rendering:pixelated";
      surface.appendChild(renderer.domElement);
      scene.add(new AmbientLight(0xcbdbe6, 1.1), light, light.target);
      if (object) { mounted = object; scene.add(object); object.traverse(node => { if (node instanceof Mesh) { node.castShadow = true; node.receiveShadow = true; } }); }
      if (shell) {
        const { world, color } = shellWorld(shell);
        for (const chunk of world.chunks()) {
          const mesh = new Mesh(meshChunk(world, chunk, color), new MeshLambertMaterial({ vertexColors: true }));
          mesh.castShadow = true; mesh.receiveShadow = true; owned.push(mesh); scene.add(mesh);
        }
      }
      const bounds = shell ? new Box3(new Vector3(0, -shell.size[1], 0), new Vector3(shell.size[0], 0, shell.size[2])) : new Box3().setFromObject(object!);
      const center = bounds.getCenter(new Vector3());
      const extent = bounds.getSize(new Vector3()).length();
      const ground = new Mesh(new PlaneGeometry(extent * 2, extent * 2), new MeshLambertMaterial({ color: 0x334138 }));
      ground.position.set(center.x, center.y, -0.05); ground.receiveShadow = true; owned.push(ground); scene.add(ground);
      light.position.copy(center).add(new Vector3(-extent, -extent, extent * 2)); light.target.position.copy(center);
      light.castShadow = true; light.shadow.mapSize.set(1024, 1024); light.shadow.normalBias = 0.1;
      Object.assign(light.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 0.1, far: extent * 5 });
      light.shadow.camera.updateProjectionMatrix();
      const camera = new OrthographicCamera();
      const active = renderer;
      let width = 1; let height = 1; let last = performance.now(); let since = last; let frames = 0; let autoAngle = 0;
      observer = new ResizeObserver(() => {
        width = surface.clientWidth; height = surface.clientHeight;
        active.setSize(Math.max(1, width), Math.max(1, height), false);
      });
      observer.observe(surface);
      const draw = (now: number) => {
        const delta = Math.min(100, now - last); last = now;
        if (settings.current.spin) autoAngle += delta * 0.018; else autoAngle = 0;
        fitCamera(camera, bounds, width / height, { inclination: 45, rotation: settings.current.angle + autoAngle, zoom: 1 });
        active.render(scene, camera); frames++;
        if (now - since >= 500) {
          const fps = frames * 1000 / (now - since);
          if (stats.current) stats.current.textContent = `${fps.toFixed(0)} FPS · ${(1000 / fps).toFixed(1)} ms · ${active.info.render.triangles} triangles · ${active.info.render.calls} calls`;
          since = now; frames = 0;
        }
        frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
    } catch { clean(); queueMicrotask(() => setError("WebGL could not start. Enable WebGL and reload.")); }
    return clean;
  }, [object, shell]);
  return <div className="relative h-full min-h-0"><div ref={host} className="h-full" />{error !== "" && <p role="alert">{error}</p>}<output ref={stats} className="absolute bottom-0 left-0 bg-black/80 px-2 text-xs text-white" /></div>;
}
