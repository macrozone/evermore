import { M, MATERIALS } from "@evermore/world";
import { DataTexture, NearestFilter, RGBAFormat, type MeshLambertMaterial } from "three";

const TILE = 16;
const WOOD: readonly number[] = [M.planks, M.log, M.fence, M.stairs, M.table];
const MASONRY: readonly number[] = [M.stoneWall, M.brickWall, M.stoneFloor];

/** Small, quiet clusters instead of single-pixel noise on every surface. */
export function surfaceTone(id: number, x: number, y: number): number {
  const hash = ((Math.floor(x / 2) * 37 + Math.floor(y / 2) * 73 + id * 19) ^ (Math.floor(y / 2) * 13)) & 31;
  if (id === M.grass || id === M.flowers) {
    if (hash < 3 && y % 4 > 0 && x % 4 < 2) return 1.16;
    return hash > 27 ? 0.92 : 1;
  }
  if (id === M.leaves) return hash < 8 ? 1.22 : hash > 22 ? 0.77 : 1;
  if (id === M.water) return y % 8 === 2 && (x + Math.floor(y / 8) * 5) % 16 < 9 ? 1.32 : y % 8 === 5 ? 0.91 : 1;
  if (WOOD.includes(id)) return y % 8 === 0 ? 0.68 : (x + Math.floor(y / 8) * 7) % 16 === 0 ? 0.83 : y % 8 === 1 ? 1.13 : 1;
  if (MASONRY.includes(id) || id === M.roof) {
    const row = Math.floor(y / 4), offset = row % 2 * 4;
    return y % 4 === 0 || (x + offset) % 8 === 0 ? 0.72 : y % 4 === 1 ? 1.17 : 1;
  }
  if (id === M.stone) return hash < 7 ? 1.13 : hash > 24 ? 0.86 : 1;
  if (id === M.glass || id === M.lantern) return x % 8 === 0 || y % 8 === 0 ? 0.45 : 1.3;
  return hash < 4 ? 1.1 : 1;
}

export function createSurfaceAtlas() {
  const data = new Uint8Array(TILE * TILE * MATERIALS.length * 4);
  for (const material of MATERIALS) for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const offset = (y * TILE * MATERIALS.length + material.id * TILE + x) * 4;
    const tone = Math.round(surfaceTone(material.id, x, y) * 180);
    data.set([tone, tone, tone, 255], offset);
    if (material.id === M.flowers && ((x === 4 && y === 5) || (x === 11 && y === 12))) data.set([255, 165, 145, 255], offset);
  }
  const texture = new DataTexture(data, TILE * MATERIALS.length, TILE, RGBAFormat);
  texture.minFilter = texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/** World-space sampling gives terrain and objects the same 8 texels/cell density. */
export function addSurfaceTextures(material: MeshLambertMaterial, atlas: DataTexture) {
  const uniforms = { surfaceAtlas: { value: atlas }, surfaceTextures: { value: true } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `attribute float materialId; varying float vMaterialId; varying vec3 vSurfacePosition; varying vec3 vSurfaceNormal;\n${shader.vertexShader}`
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvMaterialId = materialId; vSurfacePosition = position; vSurfaceNormal = normal;");
    shader.fragmentShader = `uniform sampler2D surfaceAtlas; uniform bool surfaceTextures; varying float vMaterialId; varying vec3 vSurfacePosition; varying vec3 vSurfaceNormal;\n${shader.fragmentShader}`
      .replace("#include <color_fragment>", `#include <color_fragment>
        if (surfaceTextures) {
          vec3 n = abs(vSurfaceNormal);
          vec2 plane = n.z > 0.5 ? vSurfacePosition.xy : n.x > 0.5 ? vSurfacePosition.yz : vSurfacePosition.xz;
          vec2 cell = floor(plane / 2.0);
          float seed = mod(cell.x * 37.0 + cell.y * 73.0, 17.0);
          vec2 pixel = mod(floor(plane * 8.0), 16.0);
          if (vMaterialId == ${M.grass}.0 || vMaterialId == ${M.leaves}.0 || vMaterialId == ${M.flowers}.0) pixel = mod(pixel + vec2(seed, mod(seed * 7.0, 16.0)), 16.0);
          vec2 uv = vec2((vMaterialId * 16.0 + pixel.x + 0.5) / ${TILE * MATERIALS.length}.0, (pixel.y + 0.5) / 16.0);
          diffuseColor.rgb *= texture2D(surfaceAtlas, uv).rgb / (180.0 / 255.0);
        }
      `);
  };
  material.customProgramCacheKey = () => "r1-surface-atlas-v1";
  return uniforms;
}
