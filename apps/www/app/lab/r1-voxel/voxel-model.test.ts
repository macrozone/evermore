import { createMeadowHouseWorld, M, World } from "@evermore/world";
import { Box3, OrthographicCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { boundsCorners, CAMERA_PRESETS, DEFAULT_CAMERA, fitCamera, meshChunk } from "./voxel-model";

function triangleCount(world: World) {
  return [...world.chunks()].reduce((sum, chunk) => {
    const geometry = meshChunk(world, chunk);
    const count = (geometry.index?.count ?? 0) / 3;
    geometry.dispose();
    return sum + count;
  }, 0);
}

describe("voxel chunk meshing", () => {
  it("emits six outward-facing quads for one cell, with south mapped to negative Y", () => {
    const world = new World({ width: 2, depth: 3, height: 4 });
    world.setCell(1, 2, 3, M.grass);
    const chunk = [...world.chunks()][0]!;
    const geometry = meshChunk(world, chunk);
    expect(geometry.index?.count).toBe(36);
    expect(geometry.boundingBox?.min.toArray()).toEqual([1, -3, 3]);
    expect(geometry.boundingBox?.max.toArray()).toEqual([2, -2, 4]);
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const index = geometry.index!;
    for (let i = 0; i < index.count; i += 3) {
      const a = new Vector3().fromBufferAttribute(position, index.getX(i));
      const b = new Vector3().fromBufferAttribute(position, index.getX(i + 1));
      const c = new Vector3().fromBufferAttribute(position, index.getX(i + 2));
      const cross = b.sub(a).cross(c.sub(a)).normalize();
      expect(cross.dot(new Vector3().fromBufferAttribute(normal, index.getX(i)))).toBeCloseTo(1);
    }
    geometry.dispose();
  });

  it("culls shared faces even between different materials and across every chunk axis", () => {
    for (const [a, b] of [
      [[31, 0, 0], [32, 0, 0]],
      [[0, 31, 0], [0, 32, 0]],
      [[0, 0, 15], [0, 0, 16]],
    ] as const) {
      const world = new World({ width: 33, depth: 33, height: 17 });
      world.setCell(a[0], a[1], a[2], M.stone);
      world.setCell(b[0], b[1], b[2], M.water);
      expect(triangleCount(world)).toBe(20);
    }
  });

  it("handles allocated air chunks without phantom geometry at partial world edges", () => {
    const world = new World({ width: 1, depth: 1, height: 1 });
    world.setCell(0, 0, 0, M.grass);
    world.setCell(0, 0, 0, M.air);
    expect(triangleCount(world)).toBe(0);
  });
});

describe("orthographic camera framing", () => {
  const world = createMeadowHouseWorld();
  const bounds = new Box3();
  for (const chunk of world.chunks()) {
    const geometry = meshChunk(world, chunk);
    if (geometry.getAttribute("position").count > 0) bounds.union(geometry.boundingBox!);
    geometry.dispose();
  }

  it("includes the complete meadow-house geometry", () => {
    expect(bounds.min.toArray()).toEqual([0, -96, 0]);
    expect(bounds.max.distanceTo(new Vector3(96, 0, 20))).toBe(0);
  });

  it("keeps all bounds inside the frustum at zoom 1 for portrait and landscape views", () => {
    for (const aspect of [0.5, 4 / 3, 16 / 9, 3]) {
      for (const inclination of [0, 15, 38, 45, 80, 90]) {
        for (const rotation of [-180, -90, 0, 25, 90, 180]) {
          const camera = new OrthographicCamera();
          fitCamera(camera, bounds, aspect, { inclination, rotation, zoom: 1 });
          for (const point of boundsCorners(bounds)) {
            point.project(camera);
            expect(Math.abs(point.x)).toBeLessThan(1);
            expect(Math.abs(point.y)).toBeLessThan(1);
            expect(Math.abs(point.z)).toBeLessThan(1);
          }
        }
      }
    }
  });

  it("aligns the 2D and top-down presets with screen axes", () => {
    for (const preset of CAMERA_PRESETS.slice(0, 2)) {
      const camera = new OrthographicCamera();
      fitCamera(camera, bounds, 16 / 9, preset.settings);
      const center = bounds.getCenter(new Vector3());
      const origin = center.clone().project(camera);
      const east = center.clone().add(new Vector3(1, 0, 0)).project(camera);
      const north = center.clone().add(new Vector3(0, 1, 0)).project(camera);
      expect(east.x).toBeGreaterThan(origin.x);
      expect(east.y).toBeCloseTo(origin.y);
      expect(north.x).toBeCloseTo(origin.x);
      expect(north.y).toBeGreaterThan(origin.y);
    }
  });

  it("zooms about the same center without moving the camera", () => {
    const camera = new OrthographicCamera();
    fitCamera(camera, bounds, 16 / 9, DEFAULT_CAMERA);
    const position = camera.position.clone();
    const original = boundsCorners(bounds)[0]!.project(camera);
    fitCamera(camera, bounds, 16 / 9, { ...DEFAULT_CAMERA, zoom: 2 });
    const zoomed = boundsCorners(bounds)[0]!.project(camera);
    expect(camera.position.equals(position)).toBe(true);
    expect(zoomed.x).toBeCloseTo(original.x * 2);
    expect(zoomed.y).toBeCloseTo(original.y * 2);
  });
});
