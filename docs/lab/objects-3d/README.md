# Pixel object → SAM 3D → voxel experiment

First offline slice of `evermore-1fo.29`, checked 2026-10-04. Open
`/lab/objects-3d` from the homepage catalog. Four existing sprites (house, oak,
well, lantern) are selectable; **none has been reconstructed with SAM in this
slice**. Import a local static GLB to compare the mesh and sampled voxel shell.
The browser makes no inference calls and retains imported files only in memory.

## Reproduce the inputs and comparison

```sh
node apps/www/scripts/prepare-sam3d-inputs.mjs
```

This regenerates `apps/www/public/objects-3d/inputs/`: RGB on white plus a binary
mask from alpha ≥128, at the original sprite dimensions, and a manifest with
source SHA-256, dimensions, mask threshold and planned seed 42. There is no
new image generation. The source prompts, model and original generation usage
remain under `public/objects/source/`; image-generation estimates are in the
[object library README](../../../apps/www/public/objects/README.md).

Use the downloadable RGB image and matching mask in a reconstruction runner,
or upload the sprite to the [official Meta demo](https://www.aidemos.meta.com/segment-anything)
and check its selected foreground. Export the **mesh GLB**, not the Gaussian
splat PLY. Load that GLB while its matching original is selected in the lab.
GLB must embed textures/buffers, contain static triangles, and be ≤10 MB and
≤100,000 triangles. Compressed/unsupported extensions are rejected. Regular
base-color textures, vertex colors, material tint and primary UV transforms
are sampled. Normal maps, emissive light, metallic shading and transparent
blending are not baked into the shell.

Use 16/24/32 cells per tile and choose 1–6 tiles of horizontal extent. Both
3D views use R1's orthographic camera fit, voxel chunk mesher and directional
light/shadow rendering. Rotation and turntable expose all sides. Statistics
show animation FPS/frame interval and rendered triangles/calls (including the
ground); surface-sample counts are separate. Download the colored cell list and its
provenance or copy settings JSON. Export is an experiment schema, **not a
world-format decision**.

Triangle surfaces are sampled at approximately half-cell spacing. The first
sample landing in each cell supplies its color (deterministic, not averaged).
This creates an approximate shell: cavities remain empty; thin surfaces and
UV seams can lose detail. Two million samples bound the CPU work. Reduce
resolution/extent or simplify if that limit is exceeded. The chosen width is
an authored scale; it is not inferred from the image. Sprite collision
footprints and heights are shown as comparison metadata, never inferred
from the shell. A tree canopy must not become a trunk-sized collision box.

## Evidence and next slice

This host is Darwin arm64. The official CUDA installation cannot run here.
No model weights, reconstructed meshes, SAM latency, GPU usage, reconstruction
bill or reverse-view quality measurements were obtained. Browser import and
voxelization are tested using an explicitly synthetic colored pyramid in the
headless check; that test asset is not presented as a SAM result.

The follow-up must produce 3–5 genuine exports from the prepared inputs,
record runner/repo revision, seed, settings, input/mask hashes, cold/warm
latency and cost, then cache the mesh and shell beside their provenance.
Assess front silhouette, lost pixel details, palette, invented backs at
0/90/180/270°, scale against authored placement and whether collision/height
can be derived without blocking entrances. Interiors and walkability need
separate validation. Integrate the dedicated shared viewer when available;
this slice reuses existing R1 rendering primitives.

See [research](research.md) for licensing and operating options.

## Validation

`pnpm typecheck`, `pnpm lint` and `pnpm test` cover the implementation.
After starting this worktree's app on its `.env.local` BASE_PORT, run
`node scripts/check-objects-3d.mjs` for the browser proof (or override
`LAB_ORIGIN` with your local app URL). `pnpm screenshot /lab/objects-3d`
captures the initial state headlessly. Saved proof shows the empty initial
state and a **synthetic pyramid import**, including mobile layout; it does
not assess SAM quality. See `proof/check.json` for the interaction coverage.
