import { describe, expect, it } from "vitest";
import { Box3, OrthographicCamera, Vector3 } from "three";
import { CAMERA_PRESETS, fitCamera } from "./voxel-model";
import { DEFAULT_LOOK, playerFocusDepth, renderDimensions } from "./pixel-look";

describe("pixel render dimensions", () => {
  it("caps wide screens while preserving a consistent pixel scale", () => {
    expect(renderDimensions(1920, 1080, DEFAULT_LOOK)).toEqual({ width: 640, height: 360 });
  });
  it("lets the pixel-size control coarsen the target", () => {
    expect(renderDimensions(1200, 600, { ...DEFAULT_LOOK, pixelSize: 4 })).toEqual({ width: 300, height: 150 });
  });
  it("keeps tiny targets valid", () => {
    expect(renderDimensions(1, 1, DEFAULT_LOOK)).toEqual({ width: 1, height: 1 });
  });
});


describe("player depth-of-field focus", () => {
  const bounds = new Box3(new Vector3(0, -64, 0), new Vector3(64, 0, 16));
  for (const preset of CAMERA_PRESETS) {
    it(`matches the depth-buffer value in ${preset.label}, after movement and zoom`, () => {
      const camera = new OrthographicCamera();
      for (const zoom of [0.5, 2.2, 8]) {
        fitCamera(camera, bounds, 16 / 9, { ...preset.settings, zoom });
        for (const position of [new Vector3(12.5, -45.5, 3), new Vector3(20, -30, 6)]) {
          const before = position.clone();
          const projected = position.clone().project(camera);
          const bufferDepth = (projected.z + 1) / 2;
          const decoded = camera.near + bufferDepth * (camera.far - camera.near);
          expect(playerFocusDepth(position, camera)).toBeCloseTo(decoded, 8);
          expect(position).toEqual(before);
        }
      }
    });
  }
  it("tracks player depth even when camera follow lags", () => {
    const camera = new OrthographicCamera();
    fitCamera(camera, bounds, 16 / 9, CAMERA_PRESETS[0]!.settings);
    const start = new Vector3(12, -45, 3);
    const moved = new Vector3(12, -41, 6);
    expect(Math.abs(playerFocusDepth(moved, camera) - playerFocusDepth(start, camera))).toBeGreaterThan(0.5);
    const initial = playerFocusDepth(moved, camera);
    camera.zoom = 8;
    camera.updateProjectionMatrix();
    expect(playerFocusDepth(moved, camera)).toBe(initial);
  });
});
