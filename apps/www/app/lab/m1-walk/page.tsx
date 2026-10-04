import Link from "next/link";
import Client from "./client";
export default function Page(){return <main className="mx-auto max-w-[1600px] px-3 py-5">
  <Link href="/lab" className="text-ice underline">Back to lab</Link>
  <h1 className="my-3 text-3xl text-gold">M1 · A home you can enter</h1>
  <p className="mb-4 text-mist">Walk to the ring at the cabin door with WASD or arrows. Press E / Enter, or use the touch button, to step inside. The room was generated from this cabin picture. Walk back to its south door to leave. Your next visit keeps the same room.</p>
  <Client />
</main>;}
