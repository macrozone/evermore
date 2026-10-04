import Link from "next/link";
import VoxelClient from "./voxel-client";

export default function VoxelPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link className="text-ice underline" href="/lab">Back to lab</Link>
      <h1 className="my-5 text-3xl text-gold">R1 · Orthographic voxels</h1>
      <p className="mb-6 text-mist">Open a world from the Book of Evermore to wake beside its bed, or explore the meadow house with WASD or arrow keys. Cross the bridge, climb the hill, or take the kitchen stairs upstairs. Enable depth of field to keep the player sharp while nearer and farther terrain softens, like a miniature scene. Adjust movement, camera follow and the focus range while keeping the world in view, then copy your settings.</p>
      <VoxelClient />
      <p className="mt-6 text-sm text-mist">Pixel rendering study with a moving sun and moon, stars, warm windows, lanterns and a garden fire. Compare day and night, soft shadows and optional tonal colour reduction. Water, glass and foliage are opaque placeholders. The placeholder player marker stays visible through roofs; interior cutaways and natural occlusion follow in the next slice.</p>
    </main>
  );
}
