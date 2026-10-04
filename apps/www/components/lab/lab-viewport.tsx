"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import styles from "./lab-viewport.module.css";

/** Keep the preview mounted and visible while scrolling or collapsing controls. */
export function LabViewport({ title, description, children, controls }: {
  title: string;
  description: string;
  children: ReactNode;
  controls: ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const controlsId = useId();
  return (
    <main className={styles.viewport}>
      <div className={styles.scene} data-lab-scene>{children}</div>
      <header className={styles.header}>
        <Link href="/lab">← Lab</Link>
        <h1>{title}</h1>
      </header>
      <section className={styles.panel} aria-label="Experiment controls" data-expanded={expanded}>
        <button type="button" className={styles.toggle} aria-expanded={expanded} aria-controls={controlsId}
          onClick={() => setExpanded(!expanded)}>
          <span>Controls</span><span>{expanded ? "Hide ▾" : "Show ▴"}</span>
        </button>
        <div id={controlsId} className={styles.content} hidden={!expanded}>
          <p className={styles.description}>{description}</p>
          {controls}
        </div>
      </section>
    </main>
  );
}

/** Native disclosure keeps control values and renderer state intact when collapsed. */
export function ControlGroup({ title, children }: { title: string; children: ReactNode }) {
  return <details className={styles.group} open>
    <summary>{title}</summary>
    <fieldset><legend className="sr-only">{title}</legend>{children}</fieldset>
  </details>;
}
