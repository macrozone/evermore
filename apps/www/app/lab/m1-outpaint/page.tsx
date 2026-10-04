import Link from "next/link";
import Client from "./client";
export default function Page() {
    return <main className="mx-auto max-w-[1600px] px-3 py-5">
  <Link href="/lab" className="text-ice underline">Back to lab</Link>
  <h1 className="my-3 text-3xl text-gold">M1.3 · Beyond the picture</h1>
  <p className="mb-4 text-mist">Walk toward an edge with WASD or arrows. The path and river continue into a new picture, loaded before you arrive. Compare the original join with an overlapping fade, inspect the enlarged seam, and see each chunk’s time and cost.</p>
  <Client />
    </main>;
}
