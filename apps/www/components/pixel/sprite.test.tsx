import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PixelSprite } from "./sprite";

describe("PixelSprite", () => {
  it("scales the source size and renders without smoothing", () => {
    const html = renderToStaticMarkup(
      <PixelSprite
        src="/sprites/slime.png"
        alt="Slime"
        width={16}
        height={12}
        scale={3}
      />,
    );

    expect(html).toContain('width="48"');
    expect(html).toContain('height="36"');
    expect(html).toMatch(/class="[^"]*pixelated/);
  });

  it("bypasses the image optimizer", () => {
    const html = renderToStaticMarkup(
      <PixelSprite
        src="/sprites/slime.png"
        alt="Slime"
        width={16}
        height={16}
      />,
    );

    expect(html).toContain('src="/sprites/slime.png"');
    expect(html).not.toContain("/_next/image");
  });

  it.each([0, 1.5, -2])("rejects scale %s", (scale) => {
    expect(() =>
      renderToStaticMarkup(
        <PixelSprite
          src="/sprites/slime.png"
          alt="Slime"
          width={16}
          height={16}
          scale={scale}
        />,
      ),
    ).toThrow(/positive integer/);
  });
});
