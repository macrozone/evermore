import type { VillageObject } from "@evermore/world";

export const OBJECT_TILE_SIZE = 16;
export type LibraryObject = VillageObject & {
  id: string;
  name: string;
  sprite: string;
  width: number;
  height: number;
  /** Ground cells relative to the northwest corner; separate from the canopy. */
  footprint: { columns: number; rows: number; occupied: readonly (readonly [number, number])[]; collision: readonly (readonly [number, number])[] };
  heightTiles: number;
};
function object(id: string, name: string, width: number, height: number, columns: number, rows: number, heightTiles: number): LibraryObject {
  const cells = Array.from({ length: columns * rows }, (_, i) => [i % columns, Math.floor(i / columns)] as const);
  const kind = id === "cottage" || id === "house" ? "building" : id === "tree" || id === "bush" ? "vegetation" : "decoration";
  return { id, name, kind, ...(kind === "building" ? { entrance: { x: Math.floor(columns / 2), y: rows } } : {}), sprite: `/objects/${id}.png`, width, height, footprint: { columns, rows, occupied: cells, collision: cells }, heightTiles };
}
/** Authored placement metadata; never infer collision from transparent sprite pixels. */
export const objectLibrary: readonly LibraryObject[] = [
  object('cottage', 'Timber cottage', 64, 64, 4, 3, 3),
  object('house', 'Village house', 96, 96, 6, 4, 5),
  object('tree', 'Old oak', 48, 64, 1, 1, 4),
  object('bush', 'Flowering shrub', 32, 32, 2, 1, 1),
  object('well', 'Village well', 32, 48, 2, 2, 2),
  object('fence', 'Timber fence', 48, 32, 3, 1, 1),
  object('lantern', 'Lantern post', 16, 48, 1, 1, 3),
];
export const objectPalettes = {
  original: [],
  hearth: ['#29252d', '#51413e', '#80604a', '#b8875b', '#dcad74', '#f2d5a0', '#f8ebcf', '#a84f43', '#cd7451', '#3b5047', '#627356', '#91a56c', '#bdc990', '#738285', '#a4a9a1', '#dfbd57'],
  dusk: ['#252337', '#3c3552', '#5d4967', '#856078', '#b5848e', '#d3acaa', '#ebd3c3', '#695286', '#9975a4', '#364b55', '#536b72', '#7b9591', '#a4b7a0', '#576182', '#8992ac', '#edc879'],
} as const;
export type ObjectPalette = keyof typeof objectPalettes;
/** Nearest palette color, retaining alpha and making no requests to the model. */
export function applyObjectPalette(pixels: Uint8ClampedArray, palette: readonly string[]) {
  if (palette.length === 0) return;
  const colors = palette.map(hex => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)));
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    let distance = Infinity;
    let nearest = colors[0]!;
    for (const color of colors) {
      const d = (pixels[i]! - color[0]!) ** 2 + (pixels[i + 1]! - color[1]!) ** 2 + (pixels[i + 2]! - color[2]!) ** 2;
      if (d < distance) { distance = d; nearest = color; }
    }
    pixels[i] = nearest[0]!; pixels[i + 1] = nearest[1]!; pixels[i + 2] = nearest[2]!;
  }
}
