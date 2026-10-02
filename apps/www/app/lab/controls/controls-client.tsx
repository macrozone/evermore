"use client";

import dynamic from "next/dynamic";

// Keep the canvas module and future browser-only renderer dependencies out of SSR.
const ControlsExperiment = dynamic(() => import("./controls-experiment"), {
  ssr: false,
  loading: () => <p role="status">Loading experiment…</p>,
});

export default function ControlsClient() {
  return <ControlsExperiment />;
}
