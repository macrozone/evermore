import { readdirSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { catalog } from "../lib/catalog";
import HomePage from "./page";
import VisionPage from "./vision/page";

describe("project overview", () => {
  it("covers every lab route in the registry and links every available entry", () => {
    const routes = readdirSync("app/lab", { withFileTypes: true }).filter((entry) => entry.isDirectory());
    for (const route of routes) {
      expect(catalog.some((entry) => entry.href === `/lab/${route.name}`)).toBe(true);
    }
    const html = renderToStaticMarkup(<HomePage />);
    for (const entry of catalog.filter((entry) => entry.status !== "planned")) {
      expect(html).toContain(`href="${entry.href}"`);
    }
    expect(html).toContain('href="/moodboards"');
    expect(html).toContain("latest saved preview");
  });
  it("renders the canonical vision with tables and repository-relative links", async () => {
    const html = renderToStaticMarkup(await VisionPage());
    expect(html).toContain("Book of Evermore");
    expect(html).toContain("<table>");
    expect(html).toContain('lang="de"');
    expect(html).toContain("https://github.com/macrozone/evermore/blob/main/docs/adr/");
    expect(html).not.toContain('href="../AGENTS.md"');
  });
});
