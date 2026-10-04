import Link from "next/link";
import VoxelClient from "./voxel-client";

export default function VoxelPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link className="text-ice underline" href="/lab">Back to lab</Link>
      <h1 className="my-5 text-3xl text-gold">R1 · Orthographic voxels</h1>
      <p className="mb-6 text-mist">Walk through the meadow house with WASD or arrow keys. Cross the bridge, climb the hill, or take the kitchen stairs upstairs. Adjust movement and camera follow while keeping the world in view, then copy your settings.</p>
      <VoxelClient />
      <p className="mt-6 text-sm text-mist">Pixel rendering study with a moving sun and moon, stars, warm windows, lanterns and a garden fire. Compare day and night, soft shadows and optional tonal colour reduction. Water, glass and foliage are opaque placeholders. The player stands in world space, casts shadows and is hidden by walls, roofs and trees. Interior cutaways follow in the next slice.</p>
    </main>
  );
}
