"use client";
import dynamic from "next/dynamic";
const Experiment=dynamic(()=>import("./experiment"),{ssr:false,loading:()=> <p role="status">Loading your home…</p>});
export default function Client(){return <Experiment/>;}
