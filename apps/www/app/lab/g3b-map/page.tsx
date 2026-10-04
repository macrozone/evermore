import Link from "next/link";
import Client from "./client";
export default function Page() {return <main className="mx-auto max-w-[1600px] px-3 py-5">
  <Link href="/lab" className="text-ice underline">Back to lab</Link>
  <h1 className="my-3 text-3xl text-gold">G3b · Walk on the picture</h1>
  <p className="mb-4 text-mist">The map stays exactly as drawn. Red marks places you cannot walk; blue marks roofs and crowns above you. Compare two ways to find these shapes, then focus the picture and move with WASD or arrows. Your silhouette stays visible behind a roof.</p>
  <Client />
</main>;}
