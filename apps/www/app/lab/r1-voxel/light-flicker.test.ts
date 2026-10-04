import { describe, expect, it } from "vitest";
import { PointLight } from "three";
import { DEFAULT_LIGHTING } from "./daylight";
import { fixtureSeed, flickerFactor } from "./light-flicker";
import { createLocalLights } from "./local-lights";
import { DEFAULT_LOOK } from "./pixel-look";

describe("flame noise", () => {
  it("is deterministic, independent per fixture, bounded and continuous", () => {
    const seed = fixtureSeed("hearth");
    expect(seed).toBe(fixtureSeed("hearth"));
    expect(seed).not.toBe(fixtureSeed("garden-fire"));
    const values = Array.from({ length: 1000 }, (_, i) => flickerFactor(seed, i / 100, 0.4, 2));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0.6);
    expect(Math.max(...values)).toBeLessThanOrEqual(1.4);
    expect(Math.max(...values)).toBeGreaterThan(Math.min(...values) + 0.1);
    expect(flickerFactor(seed, 1 - 1e-6, 0.4, 2)).toBeCloseTo(flickerFactor(seed, 1 + 1e-6, 0.4, 2), 5);
    expect(flickerFactor(seed, 3, 0.4, 2)).not.toBe(flickerFactor(fixtureSeed("garden-fire"), 3, 0.4, 2));
    expect(flickerFactor(seed, 3, 0, 2)).toBe(1);
    expect(flickerFactor(seed, 3, 0.4, 0)).toBe(1);
  });
});

describe("local light integration", () => {
  it("varies both fire intensities across idle ticks with unchanged default settings", () => {
    const sources = createLocalLights();
    const lights = sources.group.children.filter((child): child is PointLight => child instanceof PointLight);
    const samples = Array.from({ length: 120 }, (_, tick) => {
      sources.update(DEFAULT_LIGHTING, DEFAULT_LOOK, tick / 30);
      return lights.map((light) => light.intensity);
    });
    for (const index of [0, 4]) {
      const values = samples.map((sample) => sample[index]!);
      expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.1);
    }
    for (const index of [1, 2, 3]) {
      expect(new Set(samples.map((sample) => sample[index])).size).toBe(1);
    }
    sources.dispose();
  });

  it("animates fire intensity and radius while lanterns and windows remain steady", () => {
    const sources = createLocalLights();
    const lights = sources.group.children.filter((child): child is PointLight => child instanceof PointLight);
    const settings = { ...DEFAULT_LIGHTING, hour: 0 };
    sources.update(settings, DEFAULT_LOOK, 0);
    const before = lights.map((light) => [light.intensity, light.distance]);
    sources.update(settings, DEFAULT_LOOK, 2.5);
    expect([lights[0]!.intensity, lights[0]!.distance]).not.toEqual(before[0]);
    expect([lights[4]!.intensity, lights[4]!.distance]).not.toEqual(before[4]);
    for (const i of [1, 2, 3]) expect([lights[i]!.intensity, lights[i]!.distance]).toEqual(before[i]);
    sources.update({ ...settings, flicker: false }, DEFAULT_LOOK, 2.5);
    expect(lights.every((light) => light.intensity === settings.intensity)).toBe(true);
    sources.update({ ...settings, localLights: false }, DEFAULT_LOOK, 3);
    expect(lights.every((light) => light.intensity === 0)).toBe(true);
    sources.dispose();
  });
});
