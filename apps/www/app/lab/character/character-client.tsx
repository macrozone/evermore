"use client";

import dynamic from "next/dynamic";

const CharacterExperiment = dynamic(() => import("./character-experiment"), {
  ssr: false,
  loading: () => <p role="status">Assembling the traveller…</p>,
});

export default function CharacterClient() { return <CharacterExperiment />; }
