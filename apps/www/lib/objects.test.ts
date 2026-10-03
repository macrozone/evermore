import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { applyObjectPalette, objectLibrary, OBJECT_TILE_SIZE } from './objects';

describe('object library placement contract', () => {
  it('provides at least six unique normalized sprites with valid ground collision cells', () => {
    expect(objectLibrary.length).toBeGreaterThanOrEqual(6);
    expect(new Set(objectLibrary.map(object => object.id)).size).toBe(objectLibrary.length);
    for (const object of objectLibrary) {
      expect(existsSync(`public${object.sprite}`)).toBe(true);
      const png = readFileSync(`public${object.sprite}`);
      expect(png.readUInt32BE(16)).toBe(object.width);
      expect(png.readUInt32BE(20)).toBe(object.height);
      expect(png[25]).toBe(6); // PNG truecolor with alpha.
      expect(object.width % OBJECT_TILE_SIZE).toBe(0);
      expect(object.height % OBJECT_TILE_SIZE).toBe(0);
      expect(object.heightTiles).toBeGreaterThan(0);
      for (const [x, y] of object.footprint.collision) {
        expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(object.footprint.columns);
        expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThan(object.footprint.rows);
        expect(object.footprint.occupied).toContainEqual([x, y]);
      }
    }
  });
  it('maps visible colors to the nearest palette entry while retaining alpha', () => {
    const pixels = new Uint8ClampedArray([245, 10, 0, 128, 10, 245, 0, 255, 90, 80, 70, 0]);
    applyObjectPalette(pixels, ['#ff0000', '#00ff00']);
    expect([...pixels]).toEqual([255, 0, 0, 128, 0, 255, 0, 255, 90, 80, 70, 0]);
  });
  it('keeps generated colors unchanged without a preview palette', () => {
    const pixels = new Uint8ClampedArray([123, 145, 167, 255]);
    applyObjectPalette(pixels, []);
    expect([...pixels]).toEqual([123, 145, 167, 255]);
  });
});
