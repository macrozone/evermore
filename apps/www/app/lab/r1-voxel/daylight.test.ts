import { describe, expect, it } from "vitest";
import { advanceHour, clockLabel, daylightAt, temperatureColor } from "./daylight";

describe("day/night cycle", () => {
  it("uses daytime sun and nighttime moon with opposite directions", () => {
    const noon = daylightAt(12);
    const midnight = daylightAt(0);
    expect(noon.sun).toBe(1);
    expect(noon.moon).toBe(0);
    expect(midnight.sun).toBe(0);
    expect(midnight.moon).toBe(1);
    expect(noon.direction.z).toBeGreaterThan(0);
    expect(midnight.moonDirection.z).toBeGreaterThan(0);
    expect(noon.direction.dot(noon.moonDirection)).toBeCloseTo(-1);
    expect(midnight.day).toBe(0);
  });
  it("moves the sun from east to west with lower elevations and longer shadows near the horizon", () => {
    const morning = daylightAt(8);
    const afternoon = daylightAt(16);
    expect(morning.direction.x).toBeGreaterThan(0);
    expect(afternoon.direction.x).toBeLessThan(0);
    expect(morning.direction.z).toBeLessThan(daylightAt(12).direction.z);
    expect(daylightAt(17.9).warmth).toBeGreaterThan(daylightAt(12).warmth);
  });
  it("stays continuous across midnight and sunrise/sunset", () => {
    expect(daylightAt(0)).toEqual(daylightAt(24));
    for (const hour of [0, 6, 18, 24]) {
      const before = daylightAt(hour - 0.0001);
      const after = daylightAt(hour + 0.0001);
      expect(before.direction.distanceTo(after.direction)).toBeLessThan(0.001);
      expect(Math.abs(before.day - after.day)).toBeLessThan(0.001);
      expect(Math.abs(before.sun - after.sun)).toBeLessThan(0.001);
      expect(Math.abs(before.moon - after.moon)).toBeLessThan(0.001);
    }
  });
  it("wraps time-lapse and bounds stalled-tab jumps", () => {
    expect(advanceHour(23.99, 0.1, 60)).toBeCloseTo(0.09);
    expect(advanceHour(12, 20, 60)).toBe(12.25);
    expect(advanceHour(12, -1, 60)).toBe(12);
    expect(clockLabel(24)).toBe("00:00");
    expect(clockLabel(18.5)).toBe("18:30");
  });
  it("changes local lights from warm amber to cool white without invalid channels", () => {
    const warm = temperatureColor(1800);
    const cool = temperatureColor(8000);
    expect(warm.r).toBeGreaterThan(warm.b);
    expect(cool.b).toBeGreaterThan(cool.r);
    for (const t of [1000, 1800, 2800, 6600, 8000, 12000]) {
      for (const v of temperatureColor(t).toArray()) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});
