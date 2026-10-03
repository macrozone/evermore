"use client";
import dynamic from "next/dynamic";
const Experiment = dynamic(() => import("./experiment"), { ssr: false, loading: () => <p role="status">Loading map lab…</p> });
export default function MapClient() { return <Experiment />; }
