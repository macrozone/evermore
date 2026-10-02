import Link from "next/link";
import VoxelClient from "./voxel-client";

export default function VoxelPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link className="text-ice underline" href="/lab">Back to lab</Link>
      <h1 className="my-5 text-3xl text-gold">R1 · Orthographic voxels</h1>
      <p className="mb-6 text-mist">The whole meadow-house world: a two-storey house, river and bridge, trees, hill stairs and tower. Adjust the view and copy your camera settings for comparison.</p>
      <VoxelClient />
      <p className="mt-6 text-sm text-mist">Static rendering study with shared material colors and simple lighting. Water, glass and foliage are opaque placeholders. Interiors remain under their roofs; player movement, cutaway and the pixel-art pass come in later slices.</p>
    </main>
  );
}
