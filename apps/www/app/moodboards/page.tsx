import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Markdown from "react-markdown";

import { moodboardLink, readMoodboards } from "../../lib/moodboards";
import styles from "./moodboards.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Evermore · Moodboards",
  robots: { index: false, follow: false },
};

export default async function MoodboardsPage() {
  const boards = await readMoodboards();
  return (
    <main className={styles.page}>
      <Link href="/">← Project overview</Link>
      <header className={styles.header}>
        <p>Evermore / Visual references</p>
        <h1>Moodboards</h1>
        <p>Explore the book, our worlds and their inhabitants. Every iteration stays visible as the direction evolves.</p>
      </header>
      {boards.length === 0 && <p>No moodboards yet. Add a board with a README and images to see it here.</p>}
      <ul className={styles.boards}>
        {boards.map((board) => {
          const preview = board.iterations[0]?.images[0];
          return (
            <li key={board.slug} className={styles.card}>
              {preview && <Link href={`/moodboards/${board.slug}`} tabIndex={-1} aria-hidden="true">
                <Image src={preview.src} alt="" width={1600} height={900} unoptimized className={styles.preview} />
              </Link>}
              <div className={styles.cardBody}>
                <h2><Link href={`/moodboards/${board.slug}`}>{board.title}</Link></h2>
                <p className={styles.meta}>{board.iterations.length} {board.iterations.length === 1 ? "iteration" : "iterations"} · {board.iterations.reduce((sum, iteration) => sum + iteration.images.length, 0)} images</p>
                <Markdown components={{ a: ({ href, children }) => <a href={moodboardLink(board.slug, href)}>{children}</a> }}>{board.description}</Markdown>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
