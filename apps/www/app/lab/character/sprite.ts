import type { CharacterSpecification } from "./specification";

export const DIRECTIONS = ["south", "west", "north", "east"] as const;
export type Direction = typeof DIRECTIONS[number];
export type PixelDensity = 16 | 24 | 32;
export interface PixelSprite { width: number; height: number; pixels: (string | null)[] }

function shade(hex: string, factor: number): string {
  return "#" + [1, 3, 5].map(offset => Math.min(255, Math.round(parseInt(hex.slice(offset, offset + 2), 16) * factor)).toString(16).padStart(2, "0")).join("");
}
/** All layers share one integer grid. Side views mirror the complete doll, including its accessory. */
export function renderCharacter(spec: CharacterSpecification, direction: Direction, frame: number, density: PixelDensity = 24): PixelSprite {
  const width = density;
  const height = Math.round(density * 4 / 3);
  const pixels: PixelSprite["pixels"] = Array(width * height).fill(null);
  const side = direction === "east" || direction === "west";
  const back = direction === "north";
  const phase = ((Math.floor(frame) % 4) + 4) % 4;
  const stride = [0, 1, 0, -1][phase]!;
  const bob = phase % 2;
  const lift = spec.body === "tall" ? -2 : spec.body === "compact" ? 2 : 0;
  const c = spec.colors;
  const outline = "#292b35";
  const darkCloth = shade(c.clothing, .65);
  const lightCloth = shade(c.clothing, 1.2);
  const darkHair = shade(c.hair, .7);
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    const x0 = Math.round(x * width / 24), x1 = Math.round((x + w) * width / 24);
    const y0 = Math.round(y * height / 32), y1 = Math.round((y + h) * height / 32);
    for (let py = Math.max(0, y0); py < Math.min(height, y1); py++) {
      for (let px = Math.max(0, x0); px < Math.min(width, x1); px++) {
        pixels[py * width + (direction === "west" ? width - 1 - px : px)] = color;
      }
    }
  };
  const edged = (x: number, y: number, w: number, h: number, color: string) => {
    rect(x, y, w, h, outline); rect(x + 1, y + 1, w - 2, h - 2, color);
  };
  // Legs and boots stay anchored while the torso bobs.
  if (side) {
    edged(9 - stride * 2, 22, 4, 7 - stride, shade(c.accent, .7));
    rect(9 - stride * 2, 27 - stride, 5, 2, shade(c.boots, .8));
    edged(11 + stride * 2, 22, 4, 7 + stride, c.accent);
    rect(11 + stride * 2, 27 + stride, 5, 2, c.boots);
  } else {
    edged(8, 22, 4, 6 + stride, shade(c.accent, .75));
    edged(12, 22, 4, 6 - stride, c.accent);
    rect(7, 27 + stride, 5, 2, c.boots); rect(12, 27 - stride, 5, 2, shade(c.boots, .8));
  }
  const torsoY = 13 + lift - bob;
  if (spec.hair === "long") edged(side ? 8 : 7, 5 + lift - bob, side ? 7 : 10, 14, darkHair);
  const torsoX = side ? 9 : 7, torsoW = side ? 7 : 10;
  edged(torsoX, torsoY, torsoW, 11 - lift, c.clothing);
  rect(torsoX + torsoW - 3, torsoY + 2, 2, 8 - lift, darkCloth);
  rect(torsoX + 1, torsoY + 1, 2, 7, lightCloth);
  if (spec.outfit !== "tunic") {
    const robe = spec.outfit === "robe";
    edged(side ? 8 : 6, 20 - bob, side ? 9 : 12, robe ? 7 : 4, c.clothing);
    rect(side ? 12 : 11, 21 - bob, 2, robe ? 5 : 2, darkCloth);
  }
  rect(torsoX + 1, 20 - bob, torsoW - 2, 2, c.accent);
  if (spec.outfit === "coat" && !back) rect(side ? 14 : 11, torsoY + 1, 1, 6, c.accent);
  // Arms swing opposite the corresponding leg.
  if (side) {
    edged(10 - stride, torsoY + 1, 4, 7, darkCloth);
    rect(11 - stride, torsoY + 7, 2, 2, c.skin);
  } else {
    edged(5, torsoY + 1 - stride, 4, 7, c.clothing);
    edged(15, torsoY + 1 + stride, 4, 7, darkCloth);
    rect(6, torsoY + 7 - stride, 2, 2, c.skin); rect(16, torsoY + 7 + stride, 2, 2, c.skin);
  }
  // Head, ears and hair establish front/back readability.
  const headY = 6 + lift - bob;
  edged(side ? 9 : 7, headY, 10, 10, c.skin);
  rect(side ? 16 : 15, headY + 3, 2, 5, shade(c.skin, .8));
  if (side) {
    rect(18, headY + 5, 2, 2, c.skin);
    rect(16, headY + 4, 1, 2, outline);
    rect(10, headY + 5, 2, 2, shade(c.skin, .85));
  } else if (!back) {
    rect(9, headY + 4, 1, 2, outline); rect(14, headY + 4, 1, 2, outline);
    rect(11, headY + 7, 2, 1, shade(c.skin, .7));
  }
  if (spec.hair !== "bald") {
    rect(side ? 9 : 7, headY, 10, 3, darkHair);
    rect(side ? 10 : 8, headY, 7, 2, c.hair);
    if (back) {
      rect(8, headY + 2, 8, spec.hair === "long" ? 12 : 5, c.hair);
      rect(14, headY + 3, 2, spec.hair === "long" ? 11 : 4, darkHair);
    } else {
      rect(side ? 9 : 7, headY + 2, 2, spec.hair === "long" ? 12 : 4, c.hair);
      if (!side) rect(15, headY + 2, 2, spec.hair === "long" ? 12 : 3, darkHair);
      rect(side ? 14 : 12, headY + 2, 2, 2, c.hair);
    }
  }
  if (spec.accessory === "satchel") {
    if (!side) for (let i = 0; i < 7; i++) rect(back ? 15 - i : 8 + i, torsoY + i, 2, 2, c.boots);
    edged(side ? 8 : back ? 5 : 15, 20 - bob, 5, 6, c.boots);
    rect(side ? 9 : back ? 6 : 16, 21 - bob, 3, 1, c.accent);
  }
  if (spec.accessory === "scarf") {
    rect(side ? 9 : 7, torsoY, side ? 8 : 10, 2, c.accent);
    rect(back ? 14 : 8, torsoY + 1, 2, 6, shade(c.accent, .85));
  }
  if (spec.accessory === "hat") {
    edged(side ? 8 : 6, headY - 2, 12, 5, c.accent);
    rect(side ? 7 : 5, headY + 2, 15, 2, shade(c.accent, .75));
  }
  return { width, height, pixels };
}

export function paintSprite(context: CanvasRenderingContext2D, sprite: PixelSprite, x = 0, y = 0) {
  sprite.pixels.forEach((color, index) => {
    if (color !== null) { context.fillStyle = color; context.fillRect(x + index % sprite.width, y + Math.floor(index / sprite.width), 1, 1); }
  });
}
