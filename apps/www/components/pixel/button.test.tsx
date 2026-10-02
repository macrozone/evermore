import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PixelButton, PixelButtonLink, pixelButtonClassName } from "./button";

describe("PixelButton", () => {
  it("renders a non-submitting button by default", () => {
    const html = renderToStaticMarkup(<PixelButton>Start</PixelButton>);

    expect(html).toMatch(/^<button type="button" class="[^"]*pixel-corners/);
    expect(html).toContain(">Start</button>");
  });

  it("keeps an explicit type and passes other props through", () => {
    const html = renderToStaticMarkup(
      <PixelButton type="submit" disabled>
        Send
      </PixelButton>,
    );

    expect(html).toContain('type="submit"');
    expect(html).toContain('disabled=""');
  });

  it("appends custom class names", () => {
    const html = renderToStaticMarkup(
      <PixelButton className="w-full">Start</PixelButton>,
    );

    expect(html).toMatch(/class="[^"]* w-full"/);
  });

  it("renders a link with the same look", () => {
    const html = renderToStaticMarkup(
      <PixelButtonLink href="/play" variant="secondary">
        Play
      </PixelButtonLink>,
    );

    expect(html).toContain('href="/play"');
    expect(html).toContain(pixelButtonClassName({ variant: "secondary" }));
  });
});

describe("pixelButtonClassName", () => {
  it("defaults to the primary, medium button", () => {
    expect(pixelButtonClassName()).toBe(
      pixelButtonClassName({ variant: "primary", size: "md" }),
    );
  });

  it("differs per variant and size", () => {
    const classNames = new Set([
      pixelButtonClassName({ variant: "primary", size: "md" }),
      pixelButtonClassName({ variant: "secondary", size: "md" }),
      pixelButtonClassName({ variant: "primary", size: "lg" }),
    ]);

    expect(classNames.size).toBe(3);
  });

  it("uses palette colors and pixel font sizes", () => {
    expect(pixelButtonClassName({ size: "lg" })).toContain("text-pixel-2x");
    expect(pixelButtonClassName()).toContain("bg-ember");
  });
});
