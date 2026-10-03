import type { z } from "zod";
import { WorldSpecificationFields, parseWorldSpecification, buildingsOverlap, spawnOverlapsBuilding, type WorldSpecification } from "./specification";

// Known CSS colors only; unknown names are discarded rather than guessed.
const COLORS: Record<string, string> = {
  black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff",
  yellow: "#ffff00", orange: "#ffa500", purple: "#800080", pink: "#ffc0cb", brown: "#a52a2a",
  gray: "#808080", grey: "#808080", silver: "#c0c0c0", gold: "#ffd700", beige: "#f5f5dc",
  tan: "#d2b48c", olive: "#808000", teal: "#008080", navy: "#000080", maroon: "#800000",
  cyan: "#00ffff", aqua: "#00ffff", magenta: "#ff00ff", lime: "#00ff00", coral: "#ff7f50",
  forestgreen: "#228b22", darkgreen: "#006400", lightblue: "#add8e6", skyblue: "#87ceeb",
  saddlebrown: "#8b4513", sienna: "#a0522d", khaki: "#f0e68c", darkslategray: "#2f4f4f",
};
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

/** Repair soft fields without supplying missing semantics or mutating the response. */
export function repairWorldSpecification(value: unknown): { specification: WorldSpecification; repairs: string[] } {
  const candidate: unknown = structuredClone(value);
  const repairs: string[] = [];
  const note = (path: string, rule: string) => repairs.push(`${path}: ${rule}`);
  if (record(candidate)) {
    if (Array.isArray(candidate.palette)) {
      candidate.palette = candidate.palette.flatMap((color, i) => {
        const path = `$.palette[${i}]`;
        if (typeof color !== "string") { note(path, "discarded invalid color"); return []; }
        const trimmed = color.trim().toLowerCase();
        const normalized = /^#[0-9a-f]{6}$/.test(trimmed) ? trimmed : /^#[0-9a-f]{3}$/.test(trimmed) ? `#${[...trimmed.slice(1)].map(c => c + c).join("")}` : Object.hasOwn(COLORS, trimmed) ? COLORS[trimmed] : undefined;
        if (normalized === undefined) { note(path, "discarded unknown color"); return []; }
        if (normalized !== color) note(path, "normalized color to hex");
        return [normalized];
      }).slice(0, 8);
      if (record(value) && Array.isArray(value.palette) && value.palette.length > 8) note("$.palette", "limited palette to eight colors");
    }
    const normalize = (object: unknown, key: string, rule: z.ZodNumber, path: string) => {
      if (!record(object) || typeof object[key] !== "number" || !Number.isFinite(object[key])) return;
      const next = Math.min(rule.maxValue ?? Infinity, Math.max(rule.minValue ?? -Infinity, Math.round(object[key] as number)));
      if (next !== object[key]) { object[key] = next; note(`${path}.${key}`, "rounded/clamped to cell bounds"); }
    };
    for (const [key, rule] of Object.entries(WorldSpecificationFields.shape.size.shape)) normalize(candidate.size, key, rule, "$.size");
    for (const [key, rule] of Object.entries(WorldSpecificationFields.shape.terrain.shape)) normalize(candidate.terrain, key, rule, "$.terrain");
    normalize(candidate.water, "level", WorldSpecificationFields.shape.water.shape.level, "$.water");
    const points: [unknown, string][] = [[candidate.spawn, "$.spawn"]];
    if (Array.isArray(candidate.landmarks)) candidate.landmarks.forEach((p, i) => points.push([p, `$.landmarks[${i}]`]));
    if (record(candidate.settlement) && Array.isArray(candidate.settlement.buildings)) candidate.settlement.buildings.forEach((b, i) => {
      const path = `$.settlement.buildings[${i}]`;
      points.push([b, path]);
      const rules = WorldSpecificationFields.shape.settlement.shape.buildings.element.shape;
      for (const key of ["width", "depth", "floors"] as const) normalize(b, key, rules[key], path);
    });
    for (const [p, path] of points) { normalize(p, "x", WorldSpecificationFields.shape.spawn.shape.x, path); normalize(p, "y", WorldSpecificationFields.shape.spawn.shape.y, path); }
  }
  // Missing fields, unsupported enums and malformed structures remain errors.
  const spec = WorldSpecificationFields.parse(candidate);
  const { width, depth } = spec.size;
  const base = Math.max(spec.terrain.elevation, spec.water.level + 1);
  const height = Math.max(spec.size.height, base + spec.terrain.relief + 7, ...spec.settlement.buildings.map(b => base + b.floors * 4 + 3));
  if (height !== spec.size.height) { spec.size.height = height; note("$.size.height", "raised to fit terrain and building floors"); }

  const move = (point: { x: number; y: number }, path: string, maxX: number, maxY: number, free: (x: number, y: number) => boolean) => {
    const x = Math.min(maxX, Math.max(1, point.x)), y = Math.min(maxY, Math.max(1, point.y));
    let best: { x: number; y: number } | undefined;
    if (free(x, y)) best = { x, y };
    else {
      let distance = Infinity;
      for (let py = 1; py <= maxY; py++) for (let px = 1; px <= maxX; px++) {
        const d = (px - x) ** 2 + (py - y) ** 2;
        if (d < distance && free(px, py)) { best = { x: px, y: py }; distance = d; }
      }
    }
    if (!best) throw new RangeError(`${path}: No free position within world bounds with required spacing`);
    if (best.x !== point.x || best.y !== point.y) { Object.assign(point, best); note(path, "moved within bounds and away from occupied cells"); }
  };
  spec.settlement.buildings.forEach((b, i) => move(b, `$.settlement.buildings[${i}]`, width - b.width - 2, depth - b.depth - 2,
    (x, y) => !spec.settlement.buildings.slice(0, i).some(other => buildingsOverlap({ ...b, x, y }, other))));
  spec.landmarks.forEach((p, i) => move(p, `$.landmarks[${i}]`, width - 2, depth - 2, () => true));
  move(spec.spawn, "$.spawn", width - 2, depth - 2, (x, y) =>
    !spec.settlement.buildings.some(b => spawnOverlapsBuilding({ x, y }, b)) && !spec.landmarks.some(p => p.x === x && p.y === y));
  return { specification: parseWorldSpecification(spec), repairs };
}
