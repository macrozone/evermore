"use client";
import dynamic from "next/dynamic";
const Experiment=dynamic(()=>import("./experiment"),{ssr:false,loading:()=> <p role="status">Loading map walk…</p>});
export default function Client(){return <Experiment/>;}
