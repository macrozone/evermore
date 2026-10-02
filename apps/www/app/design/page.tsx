import { formatPageTitle } from "@evermore/core";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import {
  PixelButton,
  PixelButtonLink,
  PixelFrame,
  PixelPanel,
  PixelSprite,
} from "../../components/pixel";
import { palette } from "../../lib/palette";

export const metadata: Metadata = {
  title: formatPageTitle("Design"),
  robots: { index: false },
};

const spriteScales = [1, 2, 4, 8];

export default function DesignPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-12">
      <header className="flex flex-col gap-4">
        <h1 className="font-display text-pixel-3x text-gold sm:text-pixel-4x">
          Design
        </h1>
        <p className="text-mist">
          The building blocks of the Evermore look: pixel fonts, a 16-color
          palette and UI primitives.
        </p>
      </header>

      <Section title="Typography">
        <div className="flex flex-col gap-4">
          {(["text-pixel", "text-pixel-2x", "text-pixel-3x", "text-pixel-4x"] as const).map(
            (size) => (
              <p key={size} className={`font-display ${size}`}>
                Press Start 2P <span className="text-slate">{size}</span>
              </p>
            ),
          )}
          <p>
            VT323 for body text: The forest of Evermore is older than any map.
            Build your own dungeons and share them with other heroes.
          </p>
        </div>
      </Section>

      <Section title="Palette">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {palette.map(({ name, hex }) => (
            <li key={name} className="flex items-center gap-3">
              <span
                className="pixel-corners size-12 shrink-0 border-4 border-snow"
                style={{ backgroundColor: hex }}
              />
              <span className="leading-none">
                {name}
                <br />
                <span className="text-xl text-mist">{hex}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-4">
          <PixelButton>Primary</PixelButton>
          <PixelButton variant="secondary">Secondary</PixelButton>
          <PixelButton size="lg">Large</PixelButton>
          <PixelButton disabled>Disabled</PixelButton>
          <PixelButtonLink href="/" variant="secondary">
            Link
          </PixelButtonLink>
        </div>
      </Section>

      <Section title="Panels">
        <div className="grid gap-6 sm:grid-cols-2">
          <PixelPanel title="Quest log">
            <p>Defeat the slime king in the caves below the old mill.</p>
          </PixelPanel>
          <PixelPanel>
            <p>A panel without a title, e.g. for dialog text.</p>
            <div className="mt-4 flex justify-end">
              <PixelButton>Next</PixelButton>
            </div>
          </PixelPanel>
        </div>
      </Section>

      <Section title="Frames & sprites">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end gap-6">
            {spriteScales.map((scale) => (
              <PixelFrame key={scale} caption={`${scale}x`}>
                <PixelSprite
                  src="/sprites/slime.png"
                  alt="Slime"
                  width={16}
                  height={16}
                  scale={scale}
                />
              </PixelFrame>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-6">
            <PixelFrame caption="pixelated">
              <PixelSprite
                src="/sprites/heart.png"
                alt="Heart, scaled without smoothing"
                width={16}
                height={16}
                scale={8}
              />
            </PixelFrame>
            <PixelFrame caption="smoothed (avoid)">
              <PixelSprite
                src="/sprites/heart.png"
                alt="Heart, scaled with smoothing"
                width={16}
                height={16}
                scale={8}
                style={{ imageRendering: "auto" }}
              />
            </PixelFrame>
          </div>
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="border-b-4 border-dusk pb-3 font-display text-pixel-2x text-ice">
        {title}
      </h2>
      {children}
    </section>
  );
}
