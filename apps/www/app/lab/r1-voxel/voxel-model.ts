import { AIR, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, getMaterial, M, type Chunk, type World } from "@evermore/world";
import { type Box3, BufferGeometry, Color, Float32BufferAttribute, MathUtils, type OrthographicCamera, Vector3 } from "three";

export type CameraSettings = { inclination: number; rotation: number; zoom: number; focus?: "home" | "world" };
export const CAMERA_PRESETS = [
  { label: "2D look", settings: { inclination: 45, rotation: 0, zoom: 1, focus: "home" } },
  { label: "Top-down", settings: { inclination: 90, rotation: 0, zoom: 1 } },
  { label: "Original", settings: { inclination: 38, rotation: 25, zoom: 1 } },
] satisfies { label: string; settings: CameraSettings }[];
export const DEFAULT_CAMERA: CameraSettings = CAMERA_PRESETS[0]!.settings;

// World axes are east/south/up; Three uses east/north/up here (camera.up = Z).
const FACES = [
  { normal: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { normal: [-1, 0, 0], corners: [[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]] },
  { normal: [0, 1, 0], corners: [[1, 1, 0], [0, 1, 0], [0, 1, 1], [1, 1, 1]] },
  { normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { normal: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { normal: [0, 0, -1], corners: [[0, 1, 0], [1, 1, 0], [1, 0, 0], [0, 0, 0]] },
] as const;

export type VoxelFineness = 1 | 2 | 4 | 8;
const DETAIL_MATERIALS: readonly number[] = [M.roof, M.leaves, M.fence, M.lantern, M.stone];

/** Visual subcells only: world coordinates, collision and serialization stay intact. */
export function detailOccupied(world: World, x: number, y: number, z: number, u: number, v: number, w: number): boolean {
  const id = world.getCell(x, y, z);
  if (id === AIR) return false;
  const same = (dx: number, dy: number, dz: number) => world.getCell(x + dx, y + dy, z + dz) === id;
  if (id === M.roof && !same(0, 0, 1)) {
    if (same(0, -1, 1)) return w < 1 - v;
    if (same(0, 1, 1)) return w < v;
  }
  if (id === M.leaves || (id === M.stone && !same(0, 0, 1) && z >= 3)) {
    if (id === M.leaves && !same(0, 0, 1)) {
      const cluster = ((x * 37) ^ (y * 73) ^ (z * 19)) & 3;
      if (w > 0.65 + cluster * 0.09) return false;
    }
    // Bevel only exposed boundaries, keeping adjacent canopy cells connected.
    const edge = (a: number, low: boolean, high: boolean) => Math.max(low ? 0 : 0.3 - a, high ? 0 : a - 0.7, 0);
    return edge(u, same(-1, 0, 0), same(1, 0, 0)) + edge(v, same(0, -1, 0), same(0, 1, 0)) + edge(w, same(0, 0, -1), same(0, 0, 1)) < 0.42;
  }
  if (id === M.fence) {
    const post = Math.abs(u - 0.5) <= 0.25 && Math.abs(v - 0.5) <= 0.25;
    const rail = (w > 0.18 && w < 0.4) || (w > 0.6 && w < 0.82);
    return post || (rail && ((Math.abs(v - 0.5) < 0.16 && (same(-1, 0, 0) || same(1, 0, 0))) || (Math.abs(u - 0.5) < 0.16 && (same(0, -1, 0) || same(0, 1, 0)))));
  }
  if (id === M.lantern) return Math.abs(u - 0.5) < 0.3 && Math.abs(v - 0.5) < 0.3 && w > 0.12 && w < 0.9;
  return true;
}

/** One indexed mesh per chunk; only detailed objects need smaller voxel faces. */
export function meshChunk(world: World, chunk: Chunk, fineness: VoxelFineness = 1): BufferGeometry {
  const positions: number[] = [], normals: number[] = [], colors: number[] = [], materialIds: number[] = [], indices: number[] = [];
  const palette = new Map<number, Color>();
  const occupied = (x: number, y: number, z: number) => {
    const cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z);
    return fineness === 1 ? world.getCell(cx, cy, cz) !== AIR : detailOccupied(world, cx, cy, cz, x - cx, y - cy, z - cz);
  };
  for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
    for (let ly = 0; ly < CHUNK_SIZE_Y; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
        const x = chunk.cx * CHUNK_SIZE_X + lx, y = chunk.cy * CHUNK_SIZE_Y + ly, z = chunk.cz * CHUNK_SIZE_Z + lz;
        const id = world.getCell(x, y, z);
        if (id === AIR) continue;
        let color = palette.get(id);
        if (color == null) { color = new Color(id === M.leaves ? 0x557c3c : getMaterial(id).color); palette.set(id, color); }
        const detail = fineness > 1 && DETAIL_MATERIALS.includes(id) && (id !== M.stone || z >= 3);
        const count = detail ? fineness : 1;
        const size = 1 / count;
        const surfaces = new Map<string, { face: typeof FACES[number]; plane: number; mask: Uint8Array }>();
        const emit = (face: typeof FACES[number], ox: number, oy: number, oz: number, wx: number, wy: number, wz: number) => {
          const [nx, ny, nz] = face.normal;
          const base = positions.length / 3;
          for (const [dx, dy, dz] of face.corners) {
            positions.push(ox + dx * wx, -(oy + dy * wy), oz + dz * wz);
            normals.push(nx, -ny, nz);
            colors.push(color!.r, color!.g, color!.b);
            materialIds.push(id);
          }
          indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
        };
        for (let sz = 0; sz < count; sz++) for (let sy = 0; sy < count; sy++) for (let sx = 0; sx < count; sx++) {
          const px = x + sx * size, py = y + sy * size, pz = z + sz * size;
          if (detail && !occupied(px + size / 2, py + size / 2, pz + size / 2)) continue;
          for (const face of FACES) {
            const [nx, ny, nz] = face.normal;
            const neighbour = world.getCell(x + nx, y + ny, z + nz);
            // Full cells bordering a shaped object also need fine boundary faces.
            const splits = !detail && fineness > 1 && DETAIL_MATERIALS.includes(neighbour) ? fineness : 1;
            const faceSize = size / splits;
            for (let a = 0; a < splits; a++) for (let b = 0; b < splits; b++) {
              const ox = px + (nx === 0 ? a * faceSize : nx > 0 ? size - faceSize : 0);
              const oy = py + (ny === 0 ? (nx === 0 ? b : a) * faceSize : ny > 0 ? size - faceSize : 0);
              const oz = pz + (nz === 0 ? b * faceSize : nz > 0 ? size - faceSize : 0);
              const cx = ox + faceSize / 2 + nx * faceSize;
              const cy = oy + faceSize / 2 + ny * faceSize;
              const cz = oz + faceSize / 2 + nz * faceSize;
              if (occupied(cx, cy, cz)) continue;
              if (faceSize === 1) { emit(face, ox, oy, oz, 1, 1, 1); continue; }
              const plane = nx !== 0 ? ox + (nx > 0 ? faceSize : 0) : ny !== 0 ? oy + (ny > 0 ? faceSize : 0) : oz + (nz > 0 ? faceSize : 0);
              const key = `${nx},${ny},${nz}:${plane}`;
              let surface = surfaces.get(key);
              if (!surface) { surface = { face, plane, mask: new Uint8Array(fineness * fineness) }; surfaces.set(key, surface); }
              const col = Math.round((nx === 0 ? ox - x : oy - y) * fineness);
              const row = Math.round((nz === 0 ? oz - z : oy - y) * fineness);
              surface.mask[row * fineness + col] = 1;
            }
          }
        }
        // Greedy rectangles retain the small silhouette steps while removing
        // redundant triangles on flat subcell faces. World-space texture UVs
        // stay unchanged when rectangles grow.
        for (const { face, plane, mask } of surfaces.values()) {
          const [nx, ny, nz] = face.normal;
          for (let row = 0; row < fineness; row++) for (let col = 0; col < fineness; col++) {
            if (mask[row * fineness + col] !== 1) continue;
            let width = 1, height = 1;
            while (col + width < fineness && mask[row * fineness + col + width] === 1) width++;
            outer: while (row + height < fineness) {
              for (let c = 0; c < width; c++) if (mask[(row + height) * fineness + col + c] !== 1) break outer;
              height++;
            }
            for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) mask[(row + r) * fineness + col + c] = 0;
            const ox = nx !== 0 ? plane : x + col / fineness;
            const oy = ny !== 0 ? plane : y + (nx !== 0 ? col : row) / fineness;
            const oz = nz !== 0 ? plane : z + row / fineness;
            emit(face, ox, oy, oz, nx !== 0 ? 0 : width / fineness, ny !== 0 ? 0 : (nx !== 0 ? width : height) / fineness, nz !== 0 ? 0 : height / fineness);
          }
        }
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setAttribute("materialId", new Float32BufferAttribute(materialIds, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function boundsCorners(bounds: Box3): Vector3[] {
  const corners: Vector3[] = [];
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) corners.push(new Vector3(x, y, z));
    }
  }
  return corners;
}

/** Fit all occupied bounds at zoom 1, also after a rotation or viewport resize. */
export function fitCamera(camera: OrthographicCamera, bounds: Box3, aspect: number, settings: CameraSettings) {
  const center = bounds.getCenter(new Vector3());
  const distance = bounds.getSize(new Vector3()).length() * 2;
  const tilt = MathUtils.degToRad(settings.inclination);
  const angle = MathUtils.degToRad(settings.rotation);
  // At the zenith, Z is parallel to the viewing direction. Use north as
  // screen-up to keep the top-down view stable and its axes aligned.
  camera.up.set(0, settings.inclination === 90 ? 1 : 0, settings.inclination === 90 ? 0 : 1);
  camera.position.copy(center).add(new Vector3(
    Math.sin(angle) * Math.cos(tilt), -Math.cos(angle) * Math.cos(tilt), Math.sin(tilt),
  ).multiplyScalar(distance));
  camera.lookAt(center);
  camera.near = 0.1;
  camera.far = distance * 3;
  camera.updateMatrixWorld(true);
  const view = boundsCorners(bounds).map((point) => point.applyMatrix4(camera.matrixWorldInverse));
  const halfWidth = Math.max(...view.map((point) => Math.abs(point.x)));
  const halfHeight = Math.max(...view.map((point) => Math.abs(point.y)));
  const height = Math.max(halfHeight, halfWidth / aspect) * 1.08;
  camera.left = -height * aspect;
  camera.right = height * aspect;
  camera.top = height;
  camera.bottom = -height;
  camera.zoom = settings.zoom;
  camera.updateProjectionMatrix();
}
