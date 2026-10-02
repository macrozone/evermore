"use client";
import dynamic from "next/dynamic";

const VoxelExperiment = dynamic(() => import("./voxel-experiment"), {
  ssr: false,
  loading: () => <p role="status">Loading voxel world…</p>,
});
export default function VoxelClient() { return <VoxelExperiment />; }
