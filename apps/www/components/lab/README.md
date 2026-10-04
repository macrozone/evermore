# Lab building blocks

Register new experiments in `apps/www/lib/catalog.ts` (name, description,
status, route). `/lab` filters the `experiment` category; the home page overview
can use the same registry. `planned` entries are shown without a link.

Viewport experiments use `LabViewport` for the title, a full-screen preview and
a collapsible controls overlay (right panel on desktop, 30% bottom sheet on
mobile). Use `ControlGroup` for native, keyboard-accessible collapsible settings
groups; hiding a group preserves its values. The preview remains mounted when the panel is collapsed. A small client component
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

`useRenderStats` counts actual rendered frames, sampled every 500 ms. Pass CPU
update/render submission duration to `recordFrame`; this does not measure GPU
time. On-demand renderers show zero FPS while idle. Three.js renderers also
provide triangles and draw calls; reset renderer.info once per complete frame
so multipass rendering includes shadows and the screen pass. `RenderStats`
keeps these measurements visible outside the scrolling controls.

With the worktree dev server running, use
`node scripts/check-lab-overlays.mjs http://127.0.0.1:<BASE_PORT>` from the root
to check desktop/mobile bounds, overlay scrolling, disclosure continuity,
slider extremes, keyboard movement and time-lapse. The headless check refreshes
the `overlay-*` screenshots in `docs/lab/screenshots`.
