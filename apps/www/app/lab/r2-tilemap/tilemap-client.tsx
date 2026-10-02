"use client";
import dynamic from "next/dynamic";

const TilemapExperiment = dynamic(() => import("./tilemap-experiment"), {
  ssr: false,
  loading: () => <p role="status">Loading tilemap…</p>,
});

export default function TilemapClient() { return <TilemapExperiment />; }
