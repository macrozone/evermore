import Link from "next/link";
import type { ComponentProps } from "react";

import { cx } from "../../lib/cx";

export type PixelButtonVariant = "primary" | "secondary";
export type PixelButtonSize = "md" | "lg";

type PixelButtonStyleProps = {
  variant?: PixelButtonVariant;
  size?: PixelButtonSize;
};

const variantClassNames: Record<PixelButtonVariant, string> = {
  primary: "bg-ember text-night hover:bg-gold",
  secondary: "bg-royal text-snow hover:bg-sky hover:text-night",
};

const sizeClassNames: Record<PixelButtonSize, string> = {
  md: "px-4 py-3 text-pixel",
  lg: "px-6 py-4 text-pixel-2x",
};

/**
 * Class names of a pixel button – for elements that are neither a
 * <button> nor a link but should look like one.
 */
export function pixelButtonClassName({
  variant = "primary",
  size = "md",
}: PixelButtonStyleProps = {}) {
  return cx(
    // clip-path also clips outlines, so focus is shown by the border color
    "pixel-corners pixel-bevel inline-flex cursor-pointer items-center justify-center gap-2 border-4 border-night font-display uppercase select-none focus-visible:border-gold focus-visible:outline-none",
    "active:translate-y-1 active:pixel-bevel-pressed",
    "disabled:cursor-not-allowed disabled:bg-slate disabled:text-mist disabled:active:translate-y-0 disabled:active:pixel-bevel",
    variantClassNames[variant],
    sizeClassNames[size],
  );
}

export type PixelButtonProps = ComponentProps<"button"> & PixelButtonStyleProps;

export function PixelButton({
  variant,
  size,
  className,
  type = "button",
  ...props
}: PixelButtonProps) {
  return (
    <button
      type={type}
      className={cx(pixelButtonClassName({ variant, size }), className)}
      {...props}
    />
  );
}

export type PixelButtonLinkProps = ComponentProps<typeof Link> &
  PixelButtonStyleProps;

/** A link that looks like a PixelButton (e.g. for calls to action). */
export function PixelButtonLink({
  variant,
  size,
  className,
  ...props
}: PixelButtonLinkProps) {
  return (
    <Link
      className={cx(pixelButtonClassName({ variant, size }), className)}
      {...props}
    />
  );
}
