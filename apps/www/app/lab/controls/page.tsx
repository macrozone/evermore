import Link from "next/link";

import ControlsClient from "./controls-client";

export default function ControlsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link className="text-ice underline" href="/lab">Back to lab</Link>
      <h1 className="my-5 text-3xl text-gold">Controls & diagnostics</h1>
      <p className="mb-6 text-mist">Focus the canvas, then move with WASD or the arrow keys. This is a controls sandbox, not a world renderer.</p>
      <ControlsClient />
    </main>
  );
}
