import Link from "next/link";
import VoxelClient from "./voxel-client";

export default function VoxelPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link className="text-ice underline" href="/lab">Back to lab</Link>
      <h1 className="my-5 text-3xl text-gold">R1 · Orthographic voxels</h1>
      <p className="mb-6 text-mist">The whole meadow-house world: a two-storey house, river and bridge, trees, hill stairs and tower. Adjust the view and copy your camera and lighting settings for comparison.</p>
      <VoxelClient />
      <p className="mt-6 text-sm text-mist">Pixel rendering study with a moving sun and moon, stars, warm windows, lanterns and a garden fire. Compare day and night, soft shadows and optional tonal colour reduction. Water, glass and foliage are opaque placeholders. Interiors remain under their roofs; player movement and cutaway come in later slices.</p>
    </main>
  );
}
