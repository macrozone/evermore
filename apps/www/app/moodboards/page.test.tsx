import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MoodboardsPage from "./page";
import MoodboardPage from "./[board]/page";
import { GET } from "./[board]/images/[file]/route";

describe("moodboard pages", () => {
  it("renders discovered boards with previews and README descriptions", async () => {
    const html = renderToStaticMarkup(await MoodboardsPage());
    expect(html).toContain('href="/moodboards/02-eigene-welt"');
    expect(html).toContain("Own World");
    expect(html).toContain("/images/it2-");
    expect(html).toContain("home");
  });
  it("renders newest galleries first, full-size links and the canonical Markdown", async () => {
    const html = renderToStaticMarkup(await MoodboardPage({ params: Promise.resolve({ board: "02-eigene-welt" }) }));
    expect(html.indexOf('id="iteration-2"')).toBeLessThan(html.indexOf('id="iteration-1"'));
    expect(html).toContain('href="/moodboards/02-eigene-welt/images/it2-waldhuette-tag.jpg"');
    expect(html).toContain('href="/moodboards/04-schattenwelt"');
    expect(html).toContain("<table>");
    expect(html).toContain('id="notes"');
  });
  it("serves original image bytes with their MIME type and rejects unknown files", async () => {
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ board: "02-eigene-welt", file: "it2-waldhuette-tag.jpg" }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 2)]).toEqual([0xff, 0xd8]);
    for (const file of ["README.md", "missing.jpg", "../README.md"]) {
      expect((await GET(new Request("http://localhost"), { params: Promise.resolve({ board: "02-eigene-welt", file }) })).status).toBe(404);
    }
  });
});
