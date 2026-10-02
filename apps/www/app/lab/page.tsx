import Link from "next/link";

import { catalog } from "../../lib/catalog";

export default function LabPage() {
  const experiments = catalog.filter((entry) => entry.category === "experiment");
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="mb-3 text-sm uppercase tracking-widest text-mist">Evermore / Lab</p>
      <h1 className="text-4xl text-gold">A world in the making</h1>
      <p className="my-6 max-w-2xl text-mist">
        Small experiments in movement, rendering and worlds made from words.
        These are works in progress; each explores one question.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {experiments.map((entry) => (
          <li key={entry.id} className="rounded-lg border border-dusk p-6">
            <p className="mb-3 text-sm text-ice">{entry.status.replaceAll("-", " ")}</p>
            <h2 className="text-xl">
              {entry.status === "planned" ? entry.name : (
                <Link className="underline decoration-gold underline-offset-4" href={entry.href}>
                  {entry.name}
                </Link>
              )}
            </h2>
            <p className="mt-3 text-mist">{entry.description}</p>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-mist">Movement: WASD or arrow keys. Focus an experiment to begin.</p>
    </main>
  );
}
