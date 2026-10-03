# Lab building blocks

Register new experiments in `apps/www/lib/catalog.ts` (name, description,
status, route). `/lab` filters the `experiment` category; the home page overview
can use the same registry. `planned` entries are shown without a link.

The server page contains the title and description. A small client component
loads the actual renderer with `next/dynamic` and `ssr: false` – see
`app/lab/controls/controls-client.tsx`. The lab layout sets `noindex, nofollow`
for all subpages.

`useMovement(surfaceRef)` returns a ref to the currently pressed keyboard codes.
`movementFromKeys(keys.current)` returns a normalized movement vector
(x east, y south) for the render loop. The surface must have `tabIndex={0}`;
keys are only captured there. Input fields stay usable.
Losing focus, a hidden tab and unmounting clear the state.

`DebugOverlay` receives `{ fps, position: { x, y, z }, seed }` from the renderer.
Publish snapshots only about four times per second, not every frame.
The controls sandbox shows a simple settings panel and copyable JSON.
Its seed is only diagnostic metadata; it does not generate a world yet.
