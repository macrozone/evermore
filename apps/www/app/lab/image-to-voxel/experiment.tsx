"use client";
import { useState } from "react";
import ComparisonExperiment from "./comparison-experiment";
import FacadeExperiment from "./facade-experiment";
import styles from "./experiment.module.css";

export default function Experiment() {
  const [experiment, setExperiment] = useState(() => new URLSearchParams(window.location.search).get("experiment") === "comparison" ? "comparison" : "facade");
  return <div>
    <div className={styles.modes} aria-label="Reconstruction experiment">
      <button type="button" aria-pressed={experiment === "facade"} onClick={() => setExperiment("facade")}>Top heights & facades</button>
      <button type="button" aria-pressed={experiment === "comparison"} onClick={() => setExperiment("comparison")}>Hand masks & Vision comparison</button>
    </div>
    {experiment === "facade" ? <FacadeExperiment /> : <ComparisonExperiment />}
  </div>;
}
