export type { Box, Vec3 } from "./geometry";
export { box, boxContains, boxVolume } from "./geometry";
export type { Material, MaterialId } from "./materials";
export { AIR, M, MATERIALS, getMaterial, isMaterialId } from "./materials";
export type { Rng } from "./rng";
export { createRng, hashSeed } from "./rng";
export type { WorldSizeReport } from "./serialization";
export {
  decodeWorld,
  deserializeWorld,
  encodeWorld,
  measureWorld,
  serializeWorld,
} from "./serialization";
export { MEADOW_HOUSE_LIGHTS, MEADOW_HOUSE_SEED, createMeadowHouseWorld } from "./test-worlds/meadow-house";
export type { Chunk, Structure, StructureKind, WorldOptions } from "./world";
export {
  CHUNK_CELLS,
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  MAX_STEP_HEIGHT,
  PLAYER_HEIGHT,
  World,
  chunkCellIndex,
} from "./world";
export type { WorldSpecification } from "./generator/specification";
export { WorldSpecificationSchema, WORLD_SPECIFICATION_SCHEMA, parseWorldSpecification, worldSpecificationError } from "./generator/specification";
export { generateWorld } from "./generator/generate";
export { WORLD_EXAMPLES } from "./generator/examples";
export { prototypeSurface, generatePrototypeChunk, connectPrototypePath } from "./generator/chunk-path-prototype";
export { deriveShadowWorld, findInfluenceOrigin, influenceAt } from "./shadow";
export type { VillageObject, ObjectPlacement, VillageOptions } from "./generator/object-village";
export { generateObjectVillage, DEFAULT_VILLAGE } from "./generator/object-village";

export { repairWorldSpecification } from "./generator/repair";
