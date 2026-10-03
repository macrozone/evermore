"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties } from "react";

import styles from "./book.module.css";
import { BOOK_MODELS, DEFAULT_BOOK_MODEL, type BookGeneration, type BookModel } from "./generation";

const questions = ["Who are you and where are you?", "Where do you sleep?"] as const;
const fonts = {
  literary: 'Georgia, "Times New Roman", serif',
  handwritten: '"Palatino Linotype", Palatino, "Book Antiqua", serif',
  simple: 'system-ui, sans-serif',
};

export default function BookExperiment() {
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState(["", ""]);
  const [font, setFont] = useState<keyof typeof fonts>("literary");
  const [fontSize, setFontSize] = useState(20);
  const [bookWidth, setBookWidth] = useState(960);
  const [turnDuration, setTurnDuration] = useState(600);
  const [copyStatus, setCopyStatus] = useState("");
  const [model, setModel] = useState<BookModel>(() => {
    const query = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("model");
    return BOOK_MODELS.includes(query as BookModel) ? query as BookModel : DEFAULT_BOOK_MODEL;
  });
  const [generation, setGeneration] = useState<BookGeneration | null>(null);
  const [pending, setPending] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const revision = useRef(0);
  const invalidate = () => { revision.current++; setGeneration(null); setGenerationError(""); };
  const generate = async () => {
    const current = revision.current;
    setPending(true); setGenerationError(""); setGeneration(null);
    try {
      const response = await fetch("/api/lab/book", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, model }), signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error("Generation failed. Please try again.");
      const result = await response.json() as BookGeneration;
      if (revision.current === current) setGeneration(result);
    } catch {
      if (revision.current === current) setGenerationError("Could not reach the book generator. Please try again.");
    } finally { setPending(false); }
  };
  const pageHeading = useRef<HTMLHeadingElement>(null);
  const settings = JSON.stringify({ font, fontSize, bookWidth, turnDuration }, null, 2);
  const theme = {
    "--book-font": fonts[font],
    "--book-font-size": `${fontSize}px`,
    "--book-width": `${bookWidth}px`,
    "--turn-duration": `${turnDuration}ms`,
  } as CSSProperties;
  const turnTo = (next: number) => {
    setPage(next);
    // The heading remains mounted, so keyboard readers keep their place on each turn.
    pageHeading.current?.focus();
  };

  return (
    <main className={styles.studio} style={theme}>
      <header className={styles.header}>
        <Link href="/lab">← Back to lab</Link>
        <span>BOOK STUDY · 01</span>
      </header>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>A world begins with a few words</p>
        <h1>The Book of Evermore</h1>
        <p>Write yourself a place to belong.</p>
      </div>
      <section className={styles.book} aria-label="Book of Evermore">
        <div className={styles.cover} aria-hidden="true" />
        <div className={styles.spread}>
          <aside className={styles.leftPage}>
            <span className={styles.ornament} aria-hidden="true">❧</span>
            <p className={styles.eyebrow}>The first chapter</p>
            <h2>{page === 0 ? "A place of your own" : page === 1 ? "Somewhere to return" : "Your beginning"}</h2>
            <p>{page === 0 ? "A name. A landscape. A little corner of the world that feels like yours." : page === 1 ? "When the journey ends, this is where you wake. Let it be a place you know." : "Two small passages, holding the beginning of a world."}</p>
            <div className={styles.seal} aria-hidden="true">E</div>
            <span className={styles.pageNumber}>{page * 2 + 1}</span>
          </aside>
          <div className={styles.rightPage}>
            <p className={styles.eyebrow}>{page < 2 ? `Passage ${page + 1} of 2` : "Written in the book"}</p>
            <h2 ref={pageHeading} tabIndex={-1} className={styles.question}>{page < 2 ? questions[page] : "This is your story so far."}</h2>
            <div key={page} className={styles.pageContent}>
              {page < 2 ? (
                <label className={styles.answerLabel}>
                  <span>Your words</span>
                  <textarea
                    aria-label={questions[page]}
                    value={answers[page]}
                    maxLength={4000}
                    placeholder={page === 0 ? "I am a wandering botanist, living beside a forest…" : "In a small room above the kitchen, beneath a quilt…"}
                    onChange={(event) => { invalidate(); setAnswers(answers.map((answer, index) => index === page ? event.target.value : answer)); }}
                  />
                </label>
              ) : (
                <dl className={styles.summary}>
                  {questions.map((question, index) => (
                    <div key={question}>
                      <dt>{question}</dt>
                      <dd>{(answers[index] ?? "").length > 0 ? answers[index] : "This passage is still unwritten."}</dd>
                      <button type="button" onClick={() => turnTo(index)}>Edit passage {index + 1}</button>
                    </div>
                  ))}
                </dl>
              )}
              <nav className={styles.navigation} aria-label="Book pages">
                <button type="button" disabled={page === 0} onClick={() => turnTo(page - 1)}>← Previous</button>
                {page < 2 && <button type="button" disabled={(answers[page] ?? "").trim().length === 0} onClick={() => turnTo(page + 1)}>{page === 0 ? "Turn the page →" : "Read your beginning →"}</button>}
              </nav>
            </div>
            <span className={styles.pageNumber}>{page * 2 + 2}</span>
          </div>
        </div>
      </section>
      <section className={styles.generation} aria-label="World specification generator">
        <div className={styles.generationControls}>
          <label>Generation model<select value={model} onChange={(event) => { invalidate(); setModel(event.target.value as BookModel); }}>
            {BOOK_MODELS.map(value => <option key={value} value={value}>{value}</option>)}
          </select></label>
          <button type="button" disabled={pending || answers.some(answer => answer.trim().length === 0)} onClick={() => void generate()}>{pending ? "Writing your world…" : "Generate world specification"}</button>
        </div>
        <p role="status">{pending ? "Turning your two passages into a world…" : generation ? `${generation.source === "vertex" ? "Generated with Vertex AI" : "Example fallback"} · ${generation.model} · ${generation.durationMs} ms · seed ${generation.seed}` : "Write both passages, then generate your beginning."}</p>
        {generation?.source === "example" && <p className={styles.fallback}>An example world is shown: {generation.fallbackReason === "disabled" ? "live generation is disabled" : generation.fallbackReason === "credentials" ? "Vertex credentials are unavailable" : generation.fallbackReason === "invalid-output" ? "the model returned an invalid world" : "the selected model could not be reached"}. It is selected by theme and does not fully interpret your passages.</p>}
        {generation?.usage && <p>Tokens · {generation.usage.inputTokens} input / {generation.usage.outputTokens} output</p>}
        {generationError.length > 0 && <p role="alert">{generationError}</p>}
        <details open className={styles.debug}>
          <summary>World specification JSON</summary>
          <pre>{generation ? JSON.stringify({ specification: generation.specification, seed: generation.seed }, null, 2) : "Your world specification will appear here."}</pre>
        </details>
      </section>
      <p className={styles.footnote}>An early book study. Your words stay here until you leave or reload the page.</p>
      <details className={styles.settings} open>
        <summary>Book settings</summary>
        <div className={styles.settingsGrid}>
          <label>Typeface<select value={font} onChange={(event) => setFont(event.target.value as keyof typeof fonts)}><option value="literary">Literary serif</option><option value="handwritten">Humanist serif</option><option value="simple">Simple sans</option></select></label>
          <label>Text size · {fontSize}px<input type="range" min={16} max={28} value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /></label>
          <label>Book width · {bookWidth}px<input type="range" min={720} max={1200} step={20} value={bookWidth} onChange={(event) => setBookWidth(Number(event.target.value))} /></label>
          <label>Page turn · {turnDuration}ms<input type="range" min={0} max={1600} step={100} value={turnDuration} onChange={(event) => setTurnDuration(Number(event.target.value))} /></label>
          <label className={styles.json}>Settings JSON<textarea readOnly value={settings} rows={6} /></label>
          <div><button type="button" onClick={() => {
            if (typeof navigator.clipboard === "undefined") { setCopyStatus("Select and copy the JSON above."); return; }
            void navigator.clipboard.writeText(settings).then(() => setCopyStatus("Copied settings."), () => setCopyStatus("Select and copy the JSON above."));
          }}>Copy settings</button><p role="status">{copyStatus}</p></div>
        </div>
      </details>
    </main>
  );
}
