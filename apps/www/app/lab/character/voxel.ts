import type { CharacterSpecification } from "./specification";
import type { Direction, PixelDensity, PixelSprite } from "./sprite";

export interface VoxelSettings { elevation: number; lightAzimuth: number; ambient: number; sunlight: number }
export const DEFAULT_VOXEL_SETTINGS: VoxelSettings = { elevation: 30, lightAzimuth: -45, ambient: .45, sunlight: .7 };
type Vec = [number, number, number];
interface Cell { position: Vec; color: string }
interface Limb { cells: Map<string, Cell>; pivot: Vec; swing: number }
interface Face { vertices: Vec[]; normal: Vec; color: string }
export interface VoxelSprite extends PixelSprite { triangles: number; calls: number }
const key = (p: Vec) => p.join(",");
const radians = (degrees: number) => degrees * Math.PI / 180;
const normals: Vec[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

/** A finite part specification becomes solid voxel volumes, in a shared local coordinate system. */
function model(spec: CharacterSpecification, frame: number): Limb[] {
  const phase = ((Math.floor(frame) % 4) + 4) % 4;
  const stride = [0, 1, 0, -1][phase]!;
  const lift = spec.body === "tall" ? 2 : spec.body === "compact" ? -2 : 0;
  const c = spec.colors;
  const limbs: Limb[] = [];
  const limb = (pivot: Vec, swing = 0) => {
    const result: Limb = { cells: new Map(), pivot, swing };
    limbs.push(result); return result;
  };
  const box = (part: Limb, origin: Vec, size: Vec, color: string) => {
    for (let x = 0; x < size[0]; x++) for (let y = 0; y < size[1]; y++) for (let z = 0; z < size[2]; z++) {
      const position: Vec = [origin[0] + x, origin[1] + y, origin[2] + z];
      part.cells.set(key(position), { position, color });
    }
  };
  const torso = limb([0, phase % 2 * .4, 0]);
  box(torso, [-4, 10, -2], [8, 8 + lift, 4], c.clothing);
  box(torso, [-4, 10, -2], [8, 1, 4], c.accent);
  if (spec.outfit !== "tunic") box(torso, [-5, spec.outfit === "robe" ? 5 : 8, -3], [10, spec.outfit === "robe" ? 5 : 2, 6], c.clothing);
  if (spec.outfit === "coat") box(torso, [0, 12, 2], [1, 5 + lift, 1], c.accent);
  const headY = 18 + lift;
  box(torso, [-4, headY, -3], [8, 8, 6], c.skin);
  box(torso, [-2, headY + 3, 3], [1, 1, 1], "#292b35");
  box(torso, [1, headY + 3, 3], [1, 1, 1], "#292b35");
  box(torso, [-1, headY + 1, 3], [2, 1, 1], "#945c49");
  if (spec.hair !== "bald") {
    box(torso, [-4, headY + 6, -3], [8, 2, 6], c.hair);
    box(torso, [-4, headY + 3, -3], [8, 3, 1], c.hair);
    box(torso, [-4, headY + 4, 2], [2, 2, 1], c.hair);
    if (spec.hair === "long") box(torso, [-4, headY - 4, -4], [8, 10, 2], c.hair);
  }
  if (spec.accessory === "hat") {
    box(torso, [-5, headY + 7, -4], [10, 1, 8], c.accent);
    box(torso, [-4, headY + 8, -3], [8, 2, 6], c.accent);
  }
  if (spec.accessory === "scarf") {
    box(torso, [-4, headY - 1, -3], [8, 1, 6], c.accent);
    box(torso, [2, headY - 6, 2], [2, 5, 1], c.accent);
  }
  if (spec.accessory === "satchel") {
    for (let y = 11; y < headY; y++) box(torso, [Math.round(3 - (y - 11) * 6 / (headY - 11)), y, 2], [1, 1, 1], c.boots);
    box(torso, [4, 8, 0], [3, 5, 4], c.boots);
    box(torso, [4, 11, 4], [3, 1, 1], c.accent);
  }
  for (const side of [-1, 1]) {
    const leg = limb([side * 2, 10, 0], stride * side * .48);
    box(leg, [-1, -8, -1], [3, 8, 3], c.accent);
    box(leg, [-1, -10, -1], [3, 2, 4], c.boots);
    const arm = limb([side * 5, 17 + lift, 0], -stride * side * .6);
    box(arm, [-1, -6, -1], [3, 6, 3], c.clothing);
    box(arm, [-1, -8, -1], [3, 2, 3], c.skin);
  }
  return limbs;
}

function rotateX([x, y, z]: Vec, angle: number): Vec { return [x, y * Math.cos(angle) - z * Math.sin(angle), y * Math.sin(angle) + z * Math.cos(angle)]; }
function rotateY([x, y, z]: Vec, angle: number): Vec { return [x * Math.cos(angle) + z * Math.sin(angle), y, -x * Math.sin(angle) + z * Math.cos(angle)]; }
const facing: Record<Direction, number> = { south: 0, west: -Math.PI / 2, north: Math.PI, east: Math.PI / 2 };

function faces(spec: CharacterSpecification, direction: Direction, frame: number): Face[] {
  const result: Face[] = [];
  for (const part of model(spec, frame)) {
    const transform = (point: Vec): Vec => {
      const rotated = rotateX(point, part.swing);
      return rotateY([rotated[0] + part.pivot[0], rotated[1] + part.pivot[1], rotated[2] + part.pivot[2]], facing[direction]);
    };
    for (const cell of part.cells.values()) for (const normal of normals) {
      const neighbor = cell.position.map((v, i) => v + normal[i]!) as Vec;
      if (part.cells.has(key(neighbor))) continue;
      const axis = normal.findIndex(v => v !== 0);
      const u = (axis + 1) % 3, v = (axis + 2) % 3;
      const vertices = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([a, b]) => {
        const point: Vec = [...cell.position];
        point[axis] = point[axis]! + (normal[axis]! > 0 ? 1 : 0);
        point[u] = point[u]! + a!; point[v] = point[v]! + b!;
        return transform(point);
      });
      result.push({ vertices, normal: rotateY(rotateX(normal, part.swing), facing[direction]), color: cell.color });
    }
  }
  return result;
}

function litColor(hex: string, normal: Vec, settings: VoxelSettings): string {
  const angle = radians(settings.lightAzimuth);
  const light: Vec = [Math.sin(angle) * .8, .6, Math.cos(angle) * .8];
  const diffuse = Math.max(0, normal.reduce((sum, n, i) => sum + n * light[i]!, 0)) * settings.sunlight;
  return "#" + [1, 3, 5].map((offset, i) => {
    const factor = settings.ambient + diffuse * [1, .94, .82][i]!;
    return Math.min(255, Math.round(parseInt(hex.slice(offset, offset + 2), 16) * factor)).toString(16).padStart(2, "0");
  }).join("");
}

/** Orthographic CPU rasterization: exterior voxel faces, world-fixed lighting and a per-pixel depth buffer. */
export function renderVoxelCharacter(spec: CharacterSpecification, direction: Direction, frame: number, density: PixelDensity = 24, settings: VoxelSettings = DEFAULT_VOXEL_SETTINGS): VoxelSprite {
  const width = density, height = Math.round(density * 4 / 3);
  const pixels: PixelSprite["pixels"] = Array(width * height).fill(null);
  const depth = new Float64Array(width * height).fill(-Infinity);
  const elevation = radians(settings.elevation), cosine = Math.cos(elevation), sine = Math.sin(elevation);
  const scale = Math.min(width / 26, height / 34);
  const project = ([x, y, z]: Vec): Vec => [width / 2 + x * scale, height / 2 - ((y - 14) * cosine - z * sine) * scale, y * sine + z * cosine];
  let triangles = 0;
  for (const face of faces(spec, direction, frame)) {
    if (face.normal[1] * sine + face.normal[2] * cosine <= 0) continue;
    const color = litColor(face.color, face.normal, settings);
    const points = face.vertices.map(project);
    for (const indices of [[0, 1, 2], [0, 2, 3]]) {
      const [a, b, c] = indices.map(i => points[i]!) as [Vec, Vec, Vec];
      const edge = (p: Vec, q: Vec, x: number, y: number) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
      const area = edge(a, b, c[0], c[1]);
      if (Math.abs(area) < 1e-8) continue;
      triangles++;
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(width - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(height - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const wa = edge(b, c, x + .5, y + .5) / area, wb = edge(c, a, x + .5, y + .5) / area, wc = 1 - wa - wb;
        if (wa < -1e-8 || wb < -1e-8 || wc < -1e-8) continue;
        const z = wa * a[2] + wb * b[2] + wc * c[2], index = y * width + x;
        if (z > depth[index]!) { depth[index] = z; pixels[index] = color; }
      }
    }
  }
  return { width, height, pixels, triangles, calls: 1 };
}
