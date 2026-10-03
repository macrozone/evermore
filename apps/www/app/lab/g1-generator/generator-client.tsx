"use client";
import dynamic from "next/dynamic";

const GeneratorExperiment = dynamic(() => import("./generator-experiment"), {
  ssr: false, loading: () => <p role="status">Loading generator…</p>,
});
export default function GeneratorClient() { return <GeneratorExperiment />; }
