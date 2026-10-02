import Image from "next/image";
import type { ComponentProps } from "react";

import { cx } from "../../lib/cx";

export type PixelSpriteProps = Omit<
  ComponentProps<typeof Image>,
  "width" | "height" | "unoptimized"
> & {
  /** Size of the source image in pixels. */
  width: number;
  height: number;
  /** Integer upscaling factor – fractions would distort the pixel grid. */
  scale?: number;
};

/**
 * Shows pixel art upscaled without smoothing. The image optimizer is
 * bypassed because resampling would blur the pixels.
 */
export function PixelSprite({
  width,
  height,
  scale = 4,
  className,
  alt,
  ...props
}: PixelSpriteProps) {
  if (!Number.isInteger(scale) || scale < 1) {
    throw new Error(`PixelSprite scale must be a positive integer, got ${scale}`);
  }

  return (
    <Image
      unoptimized
      alt={alt}
      width={width * scale}
      height={height * scale}
      className={cx("pixelated", className)}
      {...props}
    />
  );
}
