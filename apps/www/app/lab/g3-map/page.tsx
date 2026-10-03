import Link from "next/link";
import MapClient from "./client";
export default function MapPage() {
  return <main className="px-3 py-5 mx-auto max-w-[1600px]">
    <Link href="/lab" className="text-ice underline">Back to lab</Link>
    <h1 className="my-3 text-3xl text-gold">G3 · Image → layered tilemap</h1>
    <p className="mb-4 text-mist">Can a map image become world data? Compare median colour quantization on the same sources. Heights and layers are hypotheses.</p>
    <MapClient />
  </main>;
}
