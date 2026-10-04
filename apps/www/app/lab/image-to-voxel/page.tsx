import Link from "next/link";
import ImageToVoxelClient from "./client";

export default function ImageToVoxelPage() {
  return <main className="mx-auto max-w-[1600px] px-4 py-6">
    <Link href="/lab" className="text-ice underline">Back to lab</Link>
    <h1 className="my-4 text-3xl text-gold">Image → voxel comparison</h1>
    <p className="mb-5 text-mist">Can a flat picture become a convincing world made of blocks? Compare the original cabin or harbour picture with the 3D reconstruction, then change the height and turn the view to spot mistakes. Patches are marked parts of the picture, such as a roof; ground anchors mark where those parts touch the ground. The cached Vision-LLM option uses height guesses from an AI that reads pictures, so you can compare those guesses with image brightness and your own corrections.</p>
    <ImageToVoxelClient />
  </main>;
}
