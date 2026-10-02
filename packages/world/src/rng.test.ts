import { describe, expect, it } from "vitest";

import { createRng, hashSeed } from "./rng";

function sample(seed: number | string, count = 5): number[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng.next());
}

describe("createRng", () => {
  it("is deterministic for the same seed", () => {
    expect(sample(42)).toEqual(sample(42));
    expect(sample("meadow")).toEqual(sample("meadow"));
  });

  it("differs between seeds", () => {
    expect(sample(1)).not.toEqual(sample(2));
  });

  it("returns floats in [0, 1)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("returns integers within the inclusive range and hits both ends", () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      seen.add(rng.int(-2, 2));
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2]);
  });

  it("rejects invalid ranges and empty picks", () => {
    const rng = createRng(3);
    expect(() => rng.int(2, 1)).toThrow(RangeError);
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  it("forks independent, reproducible streams", () => {
    const a = createRng(9).fork("trees");
    const b = createRng(9).fork("trees");
    const c = createRng(9).fork("rocks");
    const draw = (rng: ReturnType<typeof createRng>) => [rng.next(), rng.next()];
    expect(draw(a)).toEqual(draw(b));
    expect(draw(createRng(9).fork("trees"))).not.toEqual(draw(c));
  });

  it("does not depend on the parent's position when forking", () => {
    const parent = createRng(9);
    parent.next();
    expect(parent.fork("x").next()).toBe(createRng(9).fork("x").next());
  });
});

describe("hashSeed", () => {
  it("normalises numbers to uint32", () => {
    expect(hashSeed(-1)).toBe(hashSeed(0xffffffff));
    expect(hashSeed("a")).toBeGreaterThanOrEqual(0);
  });
});
