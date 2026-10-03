import Link from "next/link";
import ImageToVoxelClient from "./client";

export default function ImageToVoxelPage() {
  return <main className="mx-auto max-w-[1600px] px-4 py-6">
    <Link href="/lab" className="text-ice underline">Back to lab</Link>
    <h1 className="my-4 text-3xl text-gold">Image → voxel comparison</h1>
    <p className="mb-5 text-mist">Turn a painted scene into a voxel shell using six flat top-height levels and a separate mask of vertical walls. Wall heights rise from the ground contact to the roof instead of following painted shadows. Switch to the hand-mask comparison to inspect manual corrections and cached Vision-model heights; hidden geometry and walkability remain unresolved.</p>
    <ImageToVoxelClient />
  </main>;
}
