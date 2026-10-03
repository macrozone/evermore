import Link from "next/link";
import GeneratorClient from "./generator-client";

export default function GeneratorPage() {
  return <main className="mx-auto max-w-5xl px-6 py-10">
    <Link href="/lab" className="text-ice underline">Back to lab</Link>
    <h1 className="my-5 text-3xl text-gold">G1 · World generator</h1>
    <p className="mb-6 text-mist">Choose a semantic specification and seed. The map shows the highest cell in each column; inspect lower floors with the slice control.</p>
    <GeneratorClient />
  </main>;
}
