import { AIR, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, getMaterial, type Chunk, type World } from "@evermore/world";
import { type Box3, BufferGeometry, Color, Float32BufferAttribute, MathUtils, type OrthographicCamera, Vector3 } from "three";

export type CameraSettings = { inclination: number; rotation: number; zoom: number };
export const DEFAULT_CAMERA: CameraSettings = { inclination: 38, rotation: 25, zoom: 1 };

// World axes are east/south/up; Three uses east/north/up here (camera.up = Z).
const FACES = [
  { normal: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { normal: [-1, 0, 0], corners: [[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]] },
  { normal: [0, 1, 0], corners: [[1, 1, 0], [0, 1, 0], [0, 1, 1], [1, 1, 1]] },
  { normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { normal: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { normal: [0, 0, -1], corners: [[0, 1, 0], [1, 1, 0], [1, 0, 0], [0, 0, 0]] },
] as const;

/** One indexed mesh per chunk. Query the world at seams to avoid internal faces. */
export function meshChunk(world: World, chunk: Chunk): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const palette = new Map<number, Color>();
  for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
    for (let ly = 0; ly < CHUNK_SIZE_Y; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
        const x = chunk.cx * CHUNK_SIZE_X + lx;
        const y = chunk.cy * CHUNK_SIZE_Y + ly;
        const z = chunk.cz * CHUNK_SIZE_Z + lz;
        const id = world.getCell(x, y, z);
        if (id === AIR) continue;
        let color = palette.get(id);
        if (color == null) { color = new Color(getMaterial(id).color); palette.set(id, color); }
        for (const { normal: [nx, ny, nz], corners } of FACES) {
          // This first slice renders every material opaque, including water/glass/leaves.
          if (world.getCell(x + nx, y + ny, z + nz) !== AIR) continue;
          const base = positions.length / 3;
          for (const [dx, dy, dz] of corners) {
            positions.push(x + dx, -(y + dy), z + dz);
            normals.push(nx, -ny, nz);
            colors.push(color.r, color.g, color.b);
          }
          // Reflecting the south axis reverses handedness, hence reversed winding.
          indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
        }
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
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
  camera.up.set(0, 0, 1);
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
