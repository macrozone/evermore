import Link from "next/link";
import ImageToVoxelClient from "./client";

export default function ImageToVoxelPage() {
  return <main className="mx-auto max-w-[1600px] px-4 py-6">
    <Link href="/lab" className="text-ice underline">Back to lab</Link>
    <h1 className="my-4 text-3xl text-gold">Image → voxel relief</h1>
    <p className="mb-5 text-mist">Compare discrete top heights, a separate facade mask and anchored walls. Inspect the original, both maps and the voxel shell together; switch to the legacy map to compare shading artifacts.</p>
    <ImageToVoxelClient />
  </main>;
}
