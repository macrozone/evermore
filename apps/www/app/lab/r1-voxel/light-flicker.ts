/** Stable fixture seeds keep flames independent across renders and reloads. */
export function fixtureSeed(id: string): number {
  let seed = 2166136261;
  for (const character of id) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return seed >>> 0;
}

function sample(seed: number, index: number): number {
  let value = Math.imul(seed ^ index, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff * 2 - 1;
}

/** Smooth bounded value noise; strength is the maximum intensity deviation. */
export function flickerFactor(seed: number, seconds: number, strength: number, speed: number): number {
  if (strength === 0 || speed === 0) return 1;
  const position = seconds * speed;
  const index = Math.floor(position);
  const fraction = position - index;
  const blend = fraction * fraction * (3 - 2 * fraction);
  const noise = sample(seed, index) * (1 - blend) + sample(seed, index + 1) * blend;
  return 1 + strength * noise;
}
