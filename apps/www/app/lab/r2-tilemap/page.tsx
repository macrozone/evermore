import Link from "next/link";
import TilemapClient from "./tilemap-client";

export default function TilemapPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link className="text-ice underline" href="/lab">Back to lab</Link>
      <h1 className="my-5 text-3xl text-gold">R2 · Layered tilemap</h1>
      <p className="mb-6 text-mist">Explore a seeded village assembled from the AI object library. Focus the world and move with WASD or arrow keys; use the overlay to change the seed, map size and house count. Switch to the meadow-house scene to compare interiors and stairs.</p>
      <TilemapClient />
      <p className="mt-6 text-sm text-mist">Procedural terrain tiles with reusable library sprites. The meadow-house comparison uses the shared test world. Height shifts tiles upward; floors inside the current building are cut away above your head. Overlapping roofs and foliage fade. This fixed view cannot show every stacked surface at once; use the layer controls to inspect it.</p>
    </main>
  );
}
