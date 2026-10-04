import { box } from '../geometry';
import { M } from '../materials';
import { World } from '../world';
import { FOREST_COTTAGE_ART } from './forest-cottage-art';

export { FOREST_COTTAGE_ART } from './forest-cottage-art';

/** Authored collision is independent of extracted art and visibility toggles. */
export function createForestCottageWorld(): World {
  const world = new World({ width: FOREST_COTTAGE_ART.width, depth: FOREST_COTTAGE_ART.depth,
    height: 12, seed: 20261003, name: 'Forest cottage', spawn: { x: 21, y: 16, z: 3 } });
  world.fill(box(0, 0, 0, world.width, world.depth, 3), M.grass);
  world.fill(box(0, 19, 2, world.width, 21, 3), M.water);
  world.fill(box(20, 14, 2, 23, world.depth, 3), M.sand);
  world.fill(box(20, 18, 2, 23, 22, 3), M.planks);
  // A small interior under the extracted roof. The southern doorway stays open.
  world.fill(box(17, 8, 2, 26, 14, 3), M.planks);
  for (const bounds of [box(17,8,3,26,9,5), box(17,8,3,18,14,5), box(25,8,3,26,14,5),
    box(17,13,3,21,14,5), box(23,13,3,26,14,5)]) world.fill(bounds, M.brickWall);
  world.addStructure({ id: 'forest-cottage', kind: 'building', name: 'Forest cottage', bounds: box(17,8,3,26,14,12) });
  for (const bounds of [box(29,6,3,38,7,5),box(29,13,3,38,14,5),box(29,6,3,30,14,5),box(37,6,3,38,14,5),
    box(30,8,3,37,12,5), box(26,12,3,28,14,5)]) world.fill(bounds,M.fence);
  // Tree trunks have tiny footprints; the much larger crowns remain walkable.
  for (const [x,y] of [[7,14],[10,6],[2,8],[38,4],[40,15],[34,2],[18,0],[25,0],
    [0,13],[1,23],[6,23],[12,23],[36,23],[42,10]] as const) {
    world.fill(box(x,y,3,x+1,y+1,5),M.log);
  }
  return world;
}

export type CottageSprite = (typeof FOREST_COTTAGE_ART.sprites)[number];

/** Match the player's visible head/feet rectangle, not just their feet cell. */
export function cottageOccludes(sprite: CottageSprite, x: number, y: number): boolean {
  return x + 0.35 > sprite.x && x - 0.35 < sprite.x + sprite.width
    && y > sprite.y && y - 1 < sprite.y + sprite.height;
}
