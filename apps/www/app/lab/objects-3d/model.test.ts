import { describe, expect, it } from "vitest";
import { Box3, BoxGeometry, Color, Group, Mesh, MeshBasicMaterial, Texture, Vector3 } from "three";
import { normalizeObject, shellWorld, validateGlb, voxelize } from "./model";

function glb(json: object) {
  const raw = new TextEncoder().encode(JSON.stringify(json));
  const length = Math.ceil(raw.length / 4) * 4;
  const data = new ArrayBuffer(20 + length); const view = new DataView(data);
  [0x46546c67, 2, data.byteLength, length, 0x4e4f534a].forEach((v, i) => view.setUint32(i * 4, v, true));
  const bytes = new Uint8Array(data, 20); bytes.fill(32); bytes.set(raw); return data;
}
function box() {
  const root = new Group(); const mesh = new Mesh(new BoxGeometry(2, 4, 2), new MeshBasicMaterial({ color: 0xcc5533 }));
  mesh.position.set(10, 20, 30); root.add(mesh); return root;
}
describe("offline mesh to voxel", () => {
  it("rejects remote dependencies, splats, animation and compressed geometry before parsing", () => {
    expect(() => validateGlb(new ArrayBuffer(32))).toThrow(/binary mesh/);
    expect(() => validateGlb(glb({ images: [{ uri: "https://example.com/texture.png" }] }))).toThrow(/external/);
    expect(() => validateGlb(glb({ extensionsUsed: ["KHR_draco_mesh_compression"] }))).toThrow(/uncompressed/);
    expect(() => validateGlb(glb({ animations: [{}] }))).toThrow(/static/);
    expect(() => validateGlb(glb({ buffers: [{ byteLength: 0 }], images: [{ bufferView: 0 }] }))).not.toThrow();
  });
  it("handles nested transforms and maps GLB Y-up to an anchored Z-up grid", () => {
    const root = box(); normalizeObject(root, 2, 16);
    const bounds = new Box3().setFromObject(root); const size = bounds.getSize(new Vector3());
    expect(bounds.min.x).toBeCloseTo(0); expect(bounds.max.y).toBeCloseTo(0); expect(bounds.min.z).toBeCloseTo(0);
    expect(size.x).toBeCloseTo(32); expect(size.z).toBeCloseTo(64);
    const shell = voxelize(root, 16, 2);
    expect(shell.cells.length).toBeGreaterThan(500);
    expect(shell.cells.every(c => c.x >= 0 && c.x < shell.size[0] && c.y >= 0 && c.y < shell.size[1] && c.z >= 0 && c.z < shell.size[2])).toBe(true);
    expect(new Set(shell.cells.map(c => `${c.x},${c.y},${c.z}`)).size).toBe(shell.cells.length);
    expect(shell.cells.some(c => c.x === 16 && c.y === 16 && c.z === 32)).toBe(false);
    const { world, color } = shellWorld(shell); const cell = shell.cells[0]!;
    expect(world.getCell(cell.x, cell.y, cell.z)).not.toBe(0); expect(color(cell.x, cell.y, cell.z)).toBe(cell.color);
    expect(color(16, 16, 32)).toBe(0xffffff);
  });
  it("samples UV texture colors and retains material tint", () => {
    const root = new Group(); const texture = new Texture(); texture.flipY = false;
    root.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: new Color(1, 1, 1), map: texture })));
    normalizeObject(root, 1, 16);
    const shell = voxelize(root, 16, 1, () => ({ width: 2, height: 1, data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]) }));
    expect(new Set(shell.cells.map(c => c.color))).toEqual(new Set([0xff0000, 0x0000ff]));
  });
  it("bounds CPU work and rejects invalid resolution", () => {
    const root = box(); normalizeObject(root, 6, 32);
    expect(() => voxelize(root, 32, 6)).toThrow(/budget/);
    expect(() => voxelize(root, 64, 6)).toThrow(/settings/);
  });
});
