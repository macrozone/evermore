import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { catalog } from "../lib/catalog";

export const metadata: Metadata = {
  title: "Evermore · Project overview",
  robots: { index: false, follow: false },
};

const sections = [
  { category: "experiment", title: "Experiments", description: "Small, playable questions about the world we are building." },
  { category: "moodboard", title: "Moodboards", description: "Visual references for home, dreams and shadows." },
  { category: "design", title: "Design", description: "Explore the current foundations. The UI direction is still open." },
  { category: "vision", title: "Vision", description: "The ideas and principles guiding Evermore." },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12" style={{ fontFamily: "system-ui, sans-serif", fontSize: "1rem", lineHeight: 1.6 }}>
      <header className="mb-12 border-b border-dusk pb-8">
        <p className="text-sm uppercase tracking-widest text-mist">Evermore / Workshop</p>
        <h1 className="mt-3 text-4xl text-gold">A world in the making</h1>
        <p className="mt-4 max-w-2xl text-mist">Explore the experiments, references and ideas behind Evermore. This is our project overview while the public landing page takes shape.</p>
        <Link className="mt-4 inline-block underline underline-offset-4" href="/lab">Open the lab →</Link>
      </header>
      {sections.map(({ category, title, description }) => {
        const entries = catalog.filter((entry) => entry.category === category);
        return (
          <section key={category} aria-labelledby={category} className="mb-12">
            <h2 id={category} className="text-2xl text-gold">{title}</h2>
            <p className="mb-5 mt-2 text-mist">{description}</p>
            {entries.length === 0 ? <p className="rounded-lg border border-dusk p-6 text-mist">No moodboards yet. References will appear here as they are added.</p> : (
              <ul className="grid gap-5 sm:grid-cols-2">
                {entries.map((entry) => (
                  <li key={entry.id} className="overflow-hidden rounded-lg border border-dusk">
                    {entry.screenshot !== undefined && <Image src={entry.screenshot} alt={`${entry.name} — latest saved preview`} width={1440} height={900} className="aspect-video w-full object-cover" />}
                    <div className="p-6">
                      <p className="mb-2 text-sm text-ice">{entry.status.replaceAll("-", " ")}</p>
                      <h3 className="text-xl">{entry.status === "planned" ? entry.name : <Link className="underline decoration-gold underline-offset-4" href={entry.href}>{entry.name}</Link>}</h3>
                      <p className="mt-3 text-mist">{entry.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </main>
  );
}
