# G2 object library

Seven isolated sprites generated on 2026-10-03 with `gemini-3.1-flash-image`
through Vertex AI, project `maw-evermore`, global endpoint. No model credentials
or network requests are shipped to the browser.

## Reproduction

From the repository root, with Google Application Default Credentials:

```sh
node apps/www/scripts/generate-objects.mjs
node apps/www/scripts/prepare-objects.mjs
```

Generation preserves existing source files. Each source has an adjacent JSON
record containing the exact prompt, model, generation time and returned token
usage. Preparation removes the reserved magenta chroma key, crops the visible
bounds and fits the sprite into a transparent canvas with nearest-neighbor
sampling. Canvas dimensions are multiples of the experimental 16 px tile size.
The pipeline uses the Sharp dependency supplied by Next.js.

`apps/www/lib/objects.ts` defines ground occupancy, collision cells and height
in tiles. These values are authored experiment metadata, not inferred physical
measurements. In particular, the oak canopy overhangs its one-cell trunk.
Downloads are the prepared original sprites; palette and pixel-size changes on
`/lab/objects` are local preview transformations.

## Generation costs

Estimated USD list-price costs, not a billing export. Each response contained
1,120 image output tokens and no text output. At $60 per million image output
tokens and $0.50 per million text input tokens:

| Object | Input tokens | Output image tokens | Estimated USD |
|---|---:|---:|---:|
| Cottage | 116 | 1,120 | 0.067258 |
| House | 117 | 1,120 | 0.067259 |
| Tree | 115 | 1,120 | 0.067258 |
| Bush | 110 | 1,120 | 0.067255 |
| Well | 116 | 1,120 | 0.067258 |
| Fence | 114 | 1,120 | 0.067257 |
| Lantern | 113 | 1,120 | 0.067257 |
| **Total** | **801** | **7,840** | **0.470801** |

Sources: [Vertex pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing)
and [model specifications](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-1-flash-image), checked 2026-10-03.

## Experiment findings

The shared prompt maintains warm materials and axis-aligned building edges.
Silhouette readability survives tile normalization, but fine detail and palette
still vary between independently generated objects. The optional preview palettes
help compare them; they are not a project-wide 16-color restriction. A reference
image and per-object scale calibration should be evaluated in a later iteration.
This slice does not generate variants or convert sprites into voxel prefabs.
