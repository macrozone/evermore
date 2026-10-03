"use client";
import dynamic from "next/dynamic";
const Experiment = dynamic(() => import("./experiment"), { ssr: false, loading: () => <p>Loading offline object lab…</p> });
export default function Client() { return <Experiment />; }
