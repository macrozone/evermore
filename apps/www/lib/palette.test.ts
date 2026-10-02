import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { palette } from "./palette";

const globalsCss = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);

const themeColors = [
  ...globalsCss.matchAll(/--color-([a-z]+):\s*(#[0-9a-f]{6});/g),
].map(([, name, hex]) => ({ name, hex }));

describe("palette", () => {
  it("has 16 distinct colors", () => {
    expect(palette).toHaveLength(16);
    expect(new Set(palette.map(({ hex }) => hex)).size).toBe(16);
  });

  it("matches the Tailwind color tokens in globals.css", () => {
    expect(themeColors).toEqual(palette.map(({ name, hex }) => ({ name, hex })));
  });

  it("disables Tailwind's default colors", () => {
    expect(globalsCss).toContain("--color-*: initial;");
  });
});
