import Link from "next/link";
import Client from "./client";
export default function Page() {
  return <main className="mx-auto max-w-[1600px] px-4 py-6">
    <Link href="/lab" className="text-ice underline">Back to lab</Link>
    <h1 className="my-3 text-3xl text-gold">Pixel objects → 3D → voxels</h1>
    <p className="mb-4 text-mist">Could a pixel sprite become a reusable 3D object? Compare four existing sprites with a mesh exported from SAM 3D, then turn its colored surface into small cubes. Load a local GLB to begin; no reconstruction has been run for these sprites yet. Rotate both views to inspect invented backs and lost details; the cubes do not establish collision or walkable interiors.</p>
    <Client />
  </main>;
}
