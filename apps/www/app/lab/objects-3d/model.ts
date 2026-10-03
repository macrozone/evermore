import { M, World } from "@evermore/world";
import { Box3, Color, Mesh, SRGBColorSpace, Vector2, Vector3, type Object3D, type Texture, type BufferGeometry, type Material } from "three";

export type Cell = { x: number; y: number; z: number; color: number };
export type Shell = { cells: Cell[]; size: [number, number, number]; resolution: number; widthTiles: number; samples: number };
const MAX_SAMPLES = 2_000_000;

/** Reject external resources before GLTFLoader can issue network requests. */
export function validateGlb(data: ArrayBuffer) {
  if (data.byteLength > 10 * 1024 * 1024 || data.byteLength < 20) throw new Error("Use a self-contained GLB under 10 MB.");
  const view = new DataView(data);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== data.byteLength || view.getUint32(16, true) !== 0x4e4f534a) throw new Error("Expected a glTF 2 binary mesh (.glb), not a Gaussian splat.");
  const length = view.getUint32(12, true);
  if (20 + length > data.byteLength) throw new Error("Invalid GLB JSON chunk.");
  type GlbDocument = { buffers?: { uri?: string }[]; images?: { uri?: string }[]; extensionsUsed?: string[]; skins?: unknown[]; animations?: unknown[]; accessors?: { count: number }[]; meshes?: { primitives: { mode?: number; targets?: unknown[]; indices?: number; attributes?: { POSITION?: number } }[] }[] };
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(data, 20, length))) as GlbDocument;
  for (const item of [...(json.buffers ?? []), ...(json.images ?? [])]) {
    if (item.uri !== undefined) throw new Error("Embed all buffers and textures in the GLB; external resources are disabled.");
  }
  if ((json.extensionsUsed ?? []).some((name: string) => !["KHR_materials_unlit", "KHR_texture_transform"].includes(name))) throw new Error("Export an uncompressed GLB with standard base-color materials.");
  if ((json.skins?.length ?? 0) > 0 || (json.animations?.length ?? 0) > 0) throw new Error("Export a static, unskinned mesh.");
  let vertices = 0;
  for (const mesh of json.meshes ?? []) for (const p of mesh.primitives ?? []) {
    if (p.mode !== undefined && p.mode !== 4 || (p.targets?.length ?? 0) > 0) throw new Error("Export static triangles.");
    vertices += json.accessors?.[p.indices ?? p.attributes?.POSITION ?? -1]?.count ?? 0;
  }
  if (vertices > 300_000) throw new Error("Simplify the mesh to at most 100,000 triangles.");
}

/** Convert glTF Y-up into R1 Z-up, fitting horizontal extent to authored tile width. */
export function normalizeObject(object: Object3D, widthTiles: number, resolution: number) {
  object.rotation.x += Math.PI / 2;
  object.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(object);
  const size = bounds.getSize(new Vector3());
  const horizontal = Math.max(size.x, size.y);
  if (![size.x, size.y, size.z].every(Number.isFinite) || horizontal < 1e-8 || size.z < 1e-8) throw new Error("Mesh must have finite, nonzero horizontal extent and height.");
  const scale = widthTiles * resolution / horizontal;
  if (size.z * scale > 384) throw new Error("Object is too tall. Reduce tile width.");
  object.scale.multiplyScalar(scale);
  object.position.multiplyScalar(scale);
  object.updateMatrixWorld(true);
  const fitted = new Box3().setFromObject(object);
  // East/south/up world cells map to Three's east/north/up.
  object.position.add(new Vector3(-fitted.min.x, -fitted.max.y, -fitted.min.z));
  object.updateMatrixWorld(true);
}

type Pixels = { data: Uint8ClampedArray; width: number; height: number };
function texturePixels(texture: Texture): Pixels {
  const image = texture.image as CanvasImageSource & { width: number; height: number };
  const width = image.width; const height = image.height;
  if (width <= 0 || height <= 0 || width * height > 16_777_216) throw new Error("Texture must be at most 16 million pixels.");
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Cannot read texture colors.");
  context.drawImage(image, 0, 0);
  return { data: context.getImageData(0, 0, width, height).data, width, height };
}

/** Approximate triangle surface sampling, not solid filling or collision inference. */
export function voxelize(object: Object3D, resolution: number, widthTiles: number, pixelsFor = texturePixels): Shell {
  if (![16, 24, 32].includes(resolution) || !Number.isFinite(widthTiles) || widthTiles < 1 || widthTiles > 6) throw new Error("Invalid grid settings.");
  object.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(object);
  const size = bounds.getSize(new Vector3());
  const dimensions = [size.x, size.y, size.z].map(v => Math.max(1, Math.ceil(v - 1e-7))) as [number, number, number];
  const cells = new Map<string, Cell>();
  const textures = new Map<Texture, Pixels>();
  // Preflight the whole sample budget before allocating cells or reading textures.
  let budget = 0;
  object.traverse(node => {
    if (!(node instanceof Mesh)) return;
    const geometry = (node as Mesh<BufferGeometry>).geometry;
    const position = geometry.getAttribute("position");
    if (position === undefined) return;
    const index = geometry.index;
    const count = index?.count ?? position.count;
    for (let t = 0; t < count; t += 3) {
      const [a, b, c] = [0, 1, 2].map(k => new Vector3().fromBufferAttribute(position, index ? index.getX(t + k) : t + k).applyMatrix4(node.matrixWorld)) as [Vector3, Vector3, Vector3];
      const steps = Math.max(1, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) * 2));
      budget += (steps + 1) * (steps + 2) / 2;
      if (!Number.isFinite(budget) || budget > MAX_SAMPLES) throw new Error("Sampling budget exceeded. Simplify mesh or reduce width/resolution.");
    }
  });
  let samples = 0;
  object.traverse(node => {
    if (!(node instanceof Mesh)) return;
    const mesh = node as Mesh<BufferGeometry, Material | Material[]>;
    const geometry = mesh.geometry;
    const position = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    const vertexColors = geometry.getAttribute("color");
    const index = geometry.index;
    if (position === undefined) return;
    const count = index?.count ?? position.count;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const ranges = geometry.groups.length > 0 ? geometry.groups : [{ start: 0, count, materialIndex: 0 }];
    for (const range of ranges) {
      const material = materials[Array.isArray(mesh.material) ? range.materialIndex ?? 0 : 0];
      if (!material || !("color" in material)) throw new Error("Use standard base-color materials.");
      const base = (material.color as Color).clone();
      const map = "map" in material ? material.map as Texture | null : null;
      if (map && (uv === undefined || map.channel !== 0)) throw new Error("Texture needs the primary UV coordinates.");
      if (map && !textures.has(map)) textures.set(map, pixelsFor(map));
      for (let t = range.start; t < Math.min(count, range.start + range.count); t += 3) {
        const ids = [0, 1, 2].map(k => index ? index.getX(t + k) : t + k);
        const [a, b, c] = ids.map(i => new Vector3().fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld)) as [Vector3, Vector3, Vector3];
        if (![...a.toArray(), ...b.toArray(), ...c.toArray()].every(Number.isFinite)) throw new Error("Mesh has invalid positions.");
        const steps = Math.max(1, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) * 2));
        samples += (steps + 1) * (steps + 2) / 2;
        if (samples > MAX_SAMPLES) throw new Error("Sampling budget exceeded. Simplify mesh or reduce width/resolution.");
        for (let i = 0; i <= steps; i++) for (let j = 0; j <= steps - i; j++) {
          const weights = [1 - (i + j) / steps, i / steps, j / steps];
          const p = a.clone().multiplyScalar(weights[0]!).addScaledVector(b, weights[1]!).addScaledVector(c, weights[2]!);
          const color = base.clone();
          if (material.vertexColors && vertexColors !== undefined) {
            const v = new Color(0, 0, 0);
            ids.forEach((id, k) => { v.r += vertexColors.getX(id) * weights[k]!; v.g += vertexColors.getY(id) * weights[k]!; v.b += vertexColors.getZ(id) * weights[k]!; });
            color.multiply(v);
          }
          if (map && uv !== undefined) {
            const coord = new Vector2();
            ids.forEach((id, k) => { coord.x += uv.getX(id) * weights[k]!; coord.y += uv.getY(id) * weights[k]!; });
            map.updateMatrix(); map.transformUv(coord);
            const pixels = textures.get(map)!;
            const tx = Math.max(0, Math.min(pixels.width - 1, Math.floor(coord.x * pixels.width)));
            const ty = Math.max(0, Math.min(pixels.height - 1, Math.floor(coord.y * pixels.height)));
            const offset = (tx + ty * pixels.width) * 4;
            if (pixels.data[offset + 3]! / 255 * material.opacity < Math.max(material.alphaTest, 0.5)) continue;
            color.multiply(new Color().setRGB(pixels.data[offset]! / 255, pixels.data[offset + 1]! / 255, pixels.data[offset + 2]! / 255, SRGBColorSpace));
          }
          const x = Math.max(0, Math.min(dimensions[0] - 1, Math.floor(p.x - bounds.min.x)));
          const y = Math.max(0, Math.min(dimensions[1] - 1, Math.floor(bounds.max.y - p.y)));
          const z = Math.max(0, Math.min(dimensions[2] - 1, Math.floor(p.z - bounds.min.z)));
          const key = `${x},${y},${z}`;
          if (!cells.has(key)) cells.set(key, { x, y, z, color: color.getHex() });
        }
      }
    }
  });
  if (cells.size === 0) throw new Error("No visible triangle surface found.");
  return { cells: [...cells.values()], size: dimensions, resolution, widthTiles, samples };
}

export function shellWorld(shell: Shell) {
  const world = new World({ width: shell.size[0], depth: shell.size[1], height: shell.size[2], name: "Imported object surface" });
  const colors = new Map<string, number>();
  for (const cell of shell.cells) { world.setCell(cell.x, cell.y, cell.z, M.stone); colors.set(`${cell.x},${cell.y},${cell.z}`, cell.color); }
  return { world, color: (x: number, y: number, z: number) => colors.get(`${x},${y},${z}`) ?? 0xffffff };
}
