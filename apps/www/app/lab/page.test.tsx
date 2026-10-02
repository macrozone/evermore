import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DebugOverlay } from "../../components/lab/debug-overlay";
import { catalog } from "../../lib/catalog";
import { metadata } from "./layout";
import LabPage from "./page";

describe("lab", () => {
  it("prevents indexing throughout the lab route tree", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
  it("lists registered experiments with descriptions and status", () => {
    const html = renderToStaticMarkup(<LabPage />);
    for (const entry of catalog.filter((entry) => entry.category === "experiment")) {
      expect(html).toContain(`href="${entry.href}"`);
      expect(html).toContain(entry.description);
      expect(html).toContain(entry.status);
    }
    expect(new Set(catalog.map((entry) => entry.id)).size).toBe(catalog.length);
  });
  it("displays all player axes, FPS and seed", () => {
    const html = renderToStaticMarkup(<DebugOverlay fps={59.8} position={{ x: 1, y: -2, z: 3 }} seed="test-seed" />);
    expect(html).toContain("60");
    expect(html).toContain("x 1.00 / y -2.00 / z 3.00");
    expect(html).toContain("test-seed");
  });
});
