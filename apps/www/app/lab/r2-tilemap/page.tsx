import Link from "next/link";
import TilemapClient from "./tilemap-client";

export default function TilemapPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <Link className="text-ice underline" href="/lab">Back to lab</Link>
      <h1 className="my-5 text-3xl text-gold">R2 · Layered tilemap</h1>
      <p className="mb-6 text-mist">Compare a forest-cottage moodboard with a playable reconstruction made from small terrain tiles and separate objects. Focus the world and move with WASD or arrow keys; check how walls block movement while roofs and tree crowns fade above you. Use the controls to inspect layers, the tile grid and evening light, or switch to the library village and meadow-house experiments.</p>
      <TilemapClient />
      <p className="mt-6 text-sm text-mist">Procedural terrain tiles with reusable library sprites. The meadow-house comparison uses the shared test world. Height shifts tiles upward; floors inside the current building are cut away above your head. Overlapping roofs and foliage fade. This fixed view cannot show every stacked surface at once; use the layer controls to inspect it.</p>
    </main>
  );
}
