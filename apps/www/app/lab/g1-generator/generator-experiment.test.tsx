import { renderToStaticMarkup } from "react-dom/server";
import { WORLD_EXAMPLES } from "@evermore/world";
import { describe, expect, it } from "vitest";
import { catalog } from "../../../lib/catalog";
import GeneratorExperiment from "./generator-experiment";

describe("G1 lab", () => {
  it("offers every example, seed and height controls, and specification JSON", () => {
    const html = renderToStaticMarkup(<GeneratorExperiment />);
    for (const spec of WORLD_EXAMPLES) expect(html).toContain(spec.name);
    expect(html).toContain("evermore-g1");
    expect(html).toContain("World specification JSON");
    expect(html).toContain("Highest visible layer");
    expect(catalog.find(entry => entry.id === "g1-generator")).toMatchObject({
      href: "/lab/g1-generator", status: "ready", category: "experiment",
    });
  });
});
