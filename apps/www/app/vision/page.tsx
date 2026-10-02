import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import styles from "./vision.module.css";

export const metadata: Metadata = {
  title: "Evermore · Product vision",
  robots: { index: false, follow: false },
};

// Render the canonical document at build time, with no second copy to maintain.
export const dynamic = "force-static";

export default async function VisionPage() {
  const source = await readFile(path.join(process.cwd(), "../../docs/vision.md"), "utf8");
  return (
    <main className={styles.document}>
      <Link href="/">← Project overview</Link>
      <p>The canonical project document is maintained in German.</p>
      <article lang="de">
        <Markdown remarkPlugins={[remarkGfm]} components={{ a: ({ href, children }) => {
          const target = href !== undefined && !/^(https?:|#)/.test(href)
            ? `https://github.com/macrozone/evermore/blob/main/${path.posix.normalize(`docs/${href}`)}`
            : href;
          return <a href={target}>{children}</a>;
        } }}>{source}</Markdown>
      </article>
    </main>
  );
}
