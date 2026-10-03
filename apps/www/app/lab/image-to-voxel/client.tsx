"use client";
import dynamic from "next/dynamic";
const Experiment = dynamic(() => import("./experiment"), { ssr: false, loading: () => <p role="status">Loading reconstruction lab…</p> });
export default function ImageToVoxelClient() { return <Experiment />; }
