import { getMaterial, M } from "@evermore/world";

export interface PixelMark { x: number; y: number; width: number; height: number; color: number }

/** Integer pixels at the shared 20px density; coordinate hashing needs no mutable RNG. */
export function tilePattern(material: number, x: number, y: number): PixelMark[] {
  const marks: PixelMark[] = [];
  const add = (px: number, py: number, width: number, height: number, color: number) => marks.push({ x: px, y: py, width, height, color });
  const seed = Math.abs((x * 73856093) ^ (y * 19349663) ^ (material * 83492791));
  const base = getMaterial(material).color;
  const shade = (factor: number) => {
    const channel = (shift: number) => Math.min(255, Math.round(((base >> shift) & 255) * factor));
    return (channel(16) << 16) | (channel(8) << 8) | channel(0);
  };
  if (material === M.grass || material === M.flowers || material === M.leaves) {
    for (let i = 0; i < 9; i++) {
      const px = (seed + i * 7) % 18;
      const py = ((seed >>> (i % 12)) + i * 11) % 17;
      add(px, py, 1, 3, shade(i % 2 !== 0 ? 1.18 : 0.78));
      add(px + 1, py + 1, 2, 1, shade(1.1));
    }
    if (material === M.flowers) for (const [px, py] of [[4, 5], [13, 11], [7, 15]] as const) {
      add(px, py, 3, 3, 0xdca278); add(px + 1, py + 1, 1, 1, 0xffdf98);
    }
  } else if (material === M.water) {
    for (let row = 2; row < 20; row += 5) {
      add((seed + row) % 8, row, 8, 1, 0x7fb6ba);
      add(12, row + 2, 5, 1, 0x285e86);
    }
  } else if (([M.planks, M.stairs, M.log, M.table, M.fence] as readonly number[]).includes(material)) {
    for (let row = 4; row < 20; row += 5) {
      add(0, row, 20, 1, shade(0.64)); add((row + seed) % 16, row - 3, 3, 1, shade(1.25));
      add((row * 3) % 20, row - 4, 1, 4, shade(0.8));
    }
    if (material === M.table) {
      add(0, 0, 20, 2, 0x6b4423); add(0, 18, 20, 2, 0x6b4423);
      add(0, 2, 2, 16, 0x6b4423); add(18, 2, 2, 16, 0x6b4423);
      add(5, 5, 6, 5, 0xedd9b6); add(13, 7, 3, 3, 0x975943);
    }
    if (material === M.fence) {
      add(0, 0, 20, 6, 0x668748); add(3, 0, 3, 20, 0xc49a65); add(14, 0, 3, 20, 0xc49a65);
    }
  } else if (material === M.roof || material === M.brickWall || material === M.stoneWall || material === M.stoneFloor || material === M.stone) {
    for (let row = 0; row < 20; row += 5) {
      add(0, row, 20, 1, shade(0.68));
      for (let col = (row % 10 !== 0 ? 5 : 0); col < 20; col += 10) {
        add(col, row, 1, 5, shade(0.7)); add(col + 2, row + 1, Math.min(7, 20 - col - 2), 1, shade(1.18));
      }
    }
  } else if (material === M.bed) {
    add(1, 1, 18, 4, 0xedd9b6); add(2, 6, 16, 12, 0xb66c61); add(4, 6, 2, 12, 0xdca278); add(0, 18, 20, 2, 0x654832);
  } else if (material === M.hearth || material === M.lantern || material === M.glass) {
    add(0, 0, 20, 3, 0x755a49); add(0, 17, 20, 3, 0x755a49);
    add(2, 3, 16, 14, 0xe7a75b); add(6, 5, 8, 10, 0xffdf98);
    add(9, 0, 2, 20, 0x755a49);
  } else {
    for (let i = 0; i < 7; i++) add((seed + i * 7) % 18, ((seed >>> i) + i * 3) % 18, 2, 1, shade(i % 2 !== 0 ? 1.15 : 0.8));
  }
  return marks;
}
