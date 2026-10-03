import { Color, MathUtils, SRGBColorSpace, Vector3 } from "three";

export const DEFAULT_LIGHTING = {
  hour: 16,
  radius: 1.5,
  intensity: 32,
  temperature: 2800,
  moonlight: 0.9,
  localLights: true,
  play: false,
  minutesPerSecond: 30,
};
export type LightingSettings = typeof DEFAULT_LIGHTING;

const smooth = (value: number) => MathUtils.smoothstep(value, 0, 1);
export function daylightAt(hour: number) {
  const wrapped = ((hour % 24) + 24) % 24;
  const angle = (wrapped - 6) / 24 * Math.PI * 2;
  const elevation = Math.sin(angle);
  const day = smooth((elevation + 0.12) / 0.35);
  const sun = smooth(elevation / 0.2);
  const moon = smooth(-elevation / 0.2);
  const warmth = 1 - smooth(elevation / 0.65);
  const direction = new Vector3(Math.cos(angle), 0.35, elevation).normalize();
  return {
    hour: wrapped, day, sun, moon, warmth, direction,
    moonDirection: direction.clone().negate(),
    sky: new Color(0x080f26).lerp(new Color(0x91b5ce), day).lerp(new Color(0xb47b79), day * warmth * 0.55),
    ambientColor: new Color(0x819bcf).lerp(new Color(0xc5d9e0), day),
    sunColor: new Color(0xffd5a0).lerp(new Color(0xff8c54), warmth),
  };
}

/** Approximate black-body colour in sRGB, converted to Three's linear space. */
export function temperatureColor(kelvin: number): Color {
  const t = MathUtils.clamp(kelvin, 1000, 12000) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return new Color().setRGB(...[r, g, b].map((v) => MathUtils.clamp(v / 255, 0, 1)) as [number, number, number], SRGBColorSpace);
}

/** Bound large jumps after a suspended tab; 24:00 wraps cleanly to midnight. */
export function advanceHour(hour: number, elapsedSeconds: number, minutesPerSecond: number): number {
  return ((hour + MathUtils.clamp(elapsedSeconds, 0, 0.25) * minutesPerSecond / 60) % 24 + 24) % 24;
}

export function clockLabel(hour: number): string {
  const minutes = Math.round(((hour % 24 + 24) % 24) * 60) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
