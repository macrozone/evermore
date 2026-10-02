import Link from "next/link";
import TilemapClient from "./tilemap-client";

export default function TilemapPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link className="text-ice underline" href="/lab">Back to lab</Link>
      <h1 className="my-5 text-3xl text-gold">R2 · Layered tilemap</h1>
      <p className="mb-6 text-mist">Focus the world and move with WASD or arrow keys. Enter the house through its south door, cross the river on the bridge, then follow the path to the hill stairs and tower.</p>
      <TilemapClient />
      <p className="mt-6 text-sm text-mist">Procedural placeholder tiles, shared meadow-house world. Height shifts tiles upward; floors inside the current building are cut away above your head. Overlapping roofs and foliage fade. This fixed view cannot show every stacked surface at once; use the layer controls to inspect it.</p>
    </main>
  );
}
