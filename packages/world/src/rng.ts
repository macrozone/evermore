/**
 * Seeded pseudo-random number generator (sfc32).
 *
 * Same seed → same sequence on every platform, so generators built on it are
 * deterministic. Not suitable for anything security related.
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] (both inclusive). */
  int(min: number, max: number): number;
  /** true with the given probability (0..1). */
  chance(probability: number): boolean;
  /** Random element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** Independent generator derived from this one's seed and a label. */
  fork(label: string): Rng;
}

/** Normalises a number or string seed to an unsigned 32-bit integer. */
export function hashSeed(seed: number | string): number {
  const text = typeof seed === "number" ? String(seed >>> 0) : seed;
  // FNV-1a
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createRng(seed: number | string): Rng {
  const base = hashSeed(seed);
  // splitmix32 expands the 32-bit seed into the 128-bit sfc32 state
  let mix = base;
  const splitmix = (): number => {
    mix = (mix + 0x9e3779b9) | 0;
    let t = mix ^ (mix >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
  };
  let a = splitmix();
  let b = splitmix();
  let c = splitmix();
  let d = splitmix();

  const nextUint32 = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };

  const rng: Rng = {
    next: () => nextUint32() / 0x100000000,
    int: (min, max) => {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new RangeError(`Invalid integer range [${min}, ${max}]`);
      }
      return min + Math.floor(rng.next() * (max - min + 1));
    },
    chance: (probability) => rng.next() < probability,
    pick: (items) => {
      if (items.length === 0) {
        throw new RangeError("Cannot pick from an empty array");
      }
      return items[Math.floor(rng.next() * items.length)] as (typeof items)[number];
    },
    fork: (label) => createRng(`${base}:${label}`),
  };
  return rng;
}
