import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";

import { cx } from "../../lib/cx";

export type PixelPanelProps = Omit<ComponentProps<"section">, "title"> & {
  /** Rendered as the panel's heading and used as its accessible name. */
  title?: ReactNode;
};

/** A 16-bit RPG style window: navy fill, light double border. */
export function PixelPanel({
  title,
  className,
  children,
  ...props
}: PixelPanelProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={title != null ? titleId : undefined}
      className={cx(
        "pixel-corners border-4 border-snow bg-navy p-6 text-snow shadow-[inset_0_0_0_var(--pixel)_var(--color-slate)]",
        className,
      )}
      {...props}
    >
      {title != null ? (
        <h2 id={titleId} className="mb-4 font-display text-pixel-2x text-gold">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}
