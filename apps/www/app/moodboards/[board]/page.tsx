import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { moodboardLink, readMoodboard } from "../../../lib/moodboards";
import styles from "../moodboards.module.css";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ board: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const board = await readMoodboard((await params).board);
  return { title: `Evermore · ${board?.title ?? "Moodboard not found"}`, robots: { index: false, follow: false } };
}

export default async function MoodboardPage({ params }: Props) {
  const board = await readMoodboard((await params).board);
  if (!board) notFound();
  return (
    <main className={styles.page}>
      <Link href="/moodboards">← All moodboards</Link>
      <header className={styles.header}>
        <h1>{board.title}</h1>
        <p>Newest iteration first. Select any image to view it at full size.</p>
        <nav aria-label="Iterations" className={styles.iterationNav}>
          {board.iterations.map(({ number }) => <a key={number} href={`#iteration-${number}`}>Iteration {number}</a>)}
          <a href="#notes">Board notes &amp; prompts</a>
        </nav>
      </header>
      {board.iterations.length === 0 && <p>No images in this board yet.</p>}
      {board.iterations.map(({ number, images }) => (
        <section key={number} id={`iteration-${number}`} className={styles.iteration} aria-labelledby={`heading-${number}`}>
          <h2 id={`heading-${number}`}>Iteration {number}{number === board.iterations[0]?.number ? " · Latest" : ""}</h2>
          <div className={styles.gallery}>
            {images.map((image) => (
              <figure key={image.filename}>
                <a href={image.src} aria-label={`View ${image.filename} at full size`}>
                  <Image src={image.src} alt={image.filename.replace(/\.[^.]+$/, "").replaceAll("-", " ")} width={1600} height={900} unoptimized className={styles.galleryImage} />
                </a>
                <figcaption>{image.filename}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
      <article id="notes" className={styles.document} aria-label="Board notes and prompts">
        <Markdown remarkPlugins={[remarkGfm]} components={{
          a: ({ href, children }) => <a href={moodboardLink(board.slug, href)}>{children}</a>,
          // Markdown images retain their original proportions and link to their source.
          img: ({ src, alt }) => typeof src === "string" ? <a href={moodboardLink(board.slug, src)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={moodboardLink(board.slug, src)} alt={alt ?? ""} loading="lazy" />
          </a> : null,
        }}>{board.markdown}</Markdown>
      </article>
    </main>
  );
}
