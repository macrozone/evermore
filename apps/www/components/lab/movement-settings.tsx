"use client";

import type { MovementConfig } from "@evermore/core";

export function MovementSettings({ value, onChange }: { value: MovementConfig; onChange: (value: MovementConfig) => void }) {
  const sliders = [
    { key: "speed", label: "Speed", unit: "cells/s", min: 1, max: 12, step: 0.5 },
    { key: "acceleration", label: "Acceleration", unit: "cells/s²", min: 10, max: 200, step: 5 },
    { key: "deceleration", label: "Deceleration", unit: "cells/s²", min: 10, max: 200, step: 5 },
    { key: "cornerTolerance", label: "Corner tolerance", unit: "cells", min: 0, max: 0.5, step: 0.025 },
  ] as const;
  return <div className="grid gap-3">
    {sliders.map(({ key, label, unit, min, max, step }) => <label key={key} className="flex flex-wrap items-center gap-3">
      {label} ({value[key]} {unit})
      <input className="max-w-full" type="range" min={min} max={max} step={step} value={value[key]} onChange={(event) => onChange({ ...value, [key]: Number(event.target.value) })} />
    </label>)}
  </div>;
}
