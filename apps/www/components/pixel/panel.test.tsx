import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PixelFrame } from "./frame";
import { PixelPanel } from "./panel";

describe("PixelPanel", () => {
  it("names the section by its title", () => {
    const html = renderToStaticMarkup(
      <PixelPanel title="Quest log">
        <p>Find the key.</p>
      </PixelPanel>,
    );

    const labelledBy = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
    expect(labelledBy).toBeDefined();
    expect(html).toContain(`<h2 id="${labelledBy}"`);
    expect(html).toContain(">Quest log</h2>");
    expect(html).toContain("<p>Find the key.</p>");
  });

  it("renders without heading when there is no title", () => {
    const html = renderToStaticMarkup(<PixelPanel>Hello</PixelPanel>);

    expect(html).not.toContain("<h2");
    expect(html).not.toContain("aria-labelledby");
  });
});

describe("PixelFrame", () => {
  it("renders an optional caption", () => {
    expect(
      renderToStaticMarkup(<PixelFrame caption="4x">sprite</PixelFrame>),
    ).toContain("<figcaption");
    expect(renderToStaticMarkup(<PixelFrame>sprite</PixelFrame>)).not.toContain(
      "<figcaption",
    );
  });
});
