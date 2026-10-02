import type { ComponentProps, ReactNode } from "react";

import { cx } from "../../lib/cx";

export type PixelFrameProps = ComponentProps<"figure"> & {
  caption?: ReactNode;
};

/** A pixel border around graphics such as sprites or screenshots. */
export function PixelFrame({
  caption,
  className,
  children,
  ...props
}: PixelFrameProps) {
  return (
    <figure
      className={cx("inline-flex flex-col items-center gap-2", className)}
      {...props}
    >
      <div className="pixel-corners pixel-bevel inline-flex border-4 border-mist bg-dusk p-3">
        {children}
      </div>
      {caption != null ? (
        <figcaption className="text-xl text-mist">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
