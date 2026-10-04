import { describe, expect, it } from 'vitest';
import { createForestCottageWorld, FOREST_COTTAGE_ART, cottageOccludes } from './forest-cottage';
import { serializeWorld, deserializeWorld } from '../serialization';

describe('forest cottage fixture', () => {
  it('has bounded atlas references and multi-tile layers', () => {
    expect(FOREST_COTTAGE_ART.ground).toHaveLength(43*24);
    expect(FOREST_COTTAGE_ART.ground.every(id => id >= 0 && id < FOREST_COTTAGE_ART.tileCount)).toBe(true);
    expect(new Set(FOREST_COTTAGE_ART.sprites.map(sprite => sprite.layer))).toEqual(new Set(['facade','objects','overhead','decoration']));
  });
  it('connects the bridge, door and interior while blocking river, walls and trunks', () => {
    const world = createForestCottageWorld();
    expect(world.isWalkable(world.spawn.x, world.spawn.y, world.spawn.z)).toBe(true);
    for(let y=9;y<world.depth;y++) expect(world.isWalkable(21,y,3), `path row ${y}`).toBe(true);
    for(const [x,y] of [[5,19],[17,10],[25,10],[30,9],[7,14]]) expect(world.isWalkable(x!,y!,3)).toBe(false);
    expect(world.isWalkable(7,11,3)).toBe(true); // under the canopy, away from its trunk
    const restored=deserializeWorld(serializeWorld(world));
    expect(restored.isWalkable(21,10,3)).toBe(true);
    expect(restored.getStructure('forest-cottage')).toEqual(world.getStructure('forest-cottage'));
  });
  it('detects coverage above the player without fading distant crowns', () => {
    const crown=FOREST_COTTAGE_ART.sprites.find(sprite=>sprite.id==='oak-west')!;
    expect(cottageOccludes(crown,7,11)).toBe(true);
    expect(cottageOccludes(crown,21,16)).toBe(false);
  });
});
