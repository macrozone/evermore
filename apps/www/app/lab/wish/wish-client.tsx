"use client";
import dynamic from "next/dynamic";
const WishExperiment = dynamic(() => import("./wish-experiment"), { ssr: false, loading: () => <p role="status">Opening the wish ledger…</p> });
export default function WishClient() { return <WishExperiment />; }
