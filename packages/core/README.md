# @evermore/core

Domain-neutral business logic shared by apps (`apps/www`) and future services.
No framework code (React, Next.js, database) – only types and pure functions.

The package is consumed as TypeScript source **without a build step**
(`exports` points to `src/index.ts`). Next.js apps therefore list it in
`transpilePackages` (see `apps/www/next.config.ts`).

```ts
import { getGameInfo } from "@evermore/core";
```

Tests live next to the code (`src/**/*.test.ts`) and run with Vitest:
`pnpm --filter @evermore/core test`.

## Movement

`createMovement(position)` creates a mutable simulation state in world-cell
units. Feed elapsed seconds to `createMovementClock()`, and call
`stepMovement(state, input, config, collision)` from its callback. The clock
runs at 60 Hz and limits pause catch-up to 250 ms. Input components range from
-1 to 1; diagonals are normalized. Positions stay fractional. Round only the
projected screen coordinates when drawing pixel art.

The collision callback receives a candidate feet-center position and returns a
reachable floor height, or `null` for a blocked footprint. It owns world bounds,
footprint size and elevation rules. Axis sweeps provide wall sliding; cardinal
input can nudge sideways toward a nearby opening within `cornerTolerance`,
without skipping collision checks. Speed is cells/s, acceleration and
deceleration are cells/s², and corner tolerance is cells.
`movementFrame(state)` exposes four walking frames; facing persists at rest.

Controls Playground and R2 share the default settings and keyboard input.
R2 samples every cell under the footprint, permitting one-cell stair risers
with local headroom while the feet center selects the rendered height.
