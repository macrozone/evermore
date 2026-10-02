"use client";

import dynamic from "next/dynamic";

const BookExperiment = dynamic(() => import("./book-experiment"), {
  ssr: false,
  loading: () => <p role="status">Opening the Book of Evermore…</p>,
});

export default function BookClient() {
  return <BookExperiment />;
}
