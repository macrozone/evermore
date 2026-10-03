import Link from "next/link";
import ImageToVoxelClient from "./client";

export default function ImageToVoxelPage() {
  return <main className="mx-auto max-w-[1600px] px-4 py-6">
    <Link href="/lab" className="text-ice underline">Back to lab</Link>
    <h1 className="my-4 text-3xl text-gold">Image → voxel comparison</h1>
    <p className="mb-5 text-mist">Compare image-space relief, hand masks and ground projection with cached Vision-LLM heights on the same cabin and harbour grids.</p>
    <ImageToVoxelClient />
  </main>;
}
