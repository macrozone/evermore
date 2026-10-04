# Asset generator experiment results

Recorded on 2026-10-04 for evermore-1fo.32. Five distinct descriptions and two additional strategy runs used real Vertex output, with Gemini 3.5 Flash-Lite for role inference and Gemini 3.1 Flash-Lite Image for images. No fallback or substituted images.

| Description | Method | Derived role / tiles | Successes | Batch latency | Estimated cost |
|---|---|---|---|---|---|
| Mossy boulder with tiny ferns | independent | object / 2 × 2 | 10/10 | 34.14 s | $0.33649 |
| Crooked fishing hut with a red tiled roof | independent | object / 3 × 3 | 10/10 | 32.92 s | $0.33684 |
| Cobblestones with grass in the joints | independent | surface / 2 × 2 | 10/10 | 36.87 s | $0.33681 |
| Flowering bush with cream blossoms | independent | object / 2 × 2 | 10/10 | 30.81 s | $0.33681 |
| Weathered wooden fence with climbing ivy | independent | strip / 3 × 2 | 10/10 | 34.95 s | $0.33683 |
| Mossy boulder with tiny ferns | reference | object / 2 × 2 | 10/10 | 39.27 s | $0.33908 |
| Mossy boulder with tiny ferns | procedural | object / 2 × 2 | 10/10 | 3.67 s | $0.03365 |

Total estimated cost: **$2.05651** for 61 image calls (70 prepared variants) and five unique role inferences. Role inference for the boulder was already cached by an earlier $0.0003424 probe; add that separately when reconciling the session total.

## Observations

All five roles were plausible without specifying a subject type: boulder, hut and bush are objects; cobblestones are a surface; fence is a strip. Ten independent images varied silhouette/material details substantially. The fixed-base boulder run retained its general outline more closely; procedural variants were fastest and cheapest, with limited shape diversity. These are one-run observations with differing seeds, not a controlled model benchmark.

The first cutout pass left reserved magenta in enclosed window/fence cavities. Preparation v3 removes pure-key cavities while retaining muted purple interiors. Prepared sprites were regenerated offline from archived raw images; no extra model calls were needed. Surface variants share periodic neighborhoods with family mean-color normalization. Decoded PNG edges match within and across the family; the mixed preview has no abrupt color/alpha joins. Repeated patterns and varying internal cobblestone scale remain visible. The generated cobblestones are warmer/redder than the description suggests; tile continuity does not establish semantic or art-direction quality. Fence segments preserve some purple-toned edge spill and differ in profile. Human art selection remains useful.

Objects were prepared at 32×32 px, huts at 48×48, ground at 32×32, and strips at 48×32. The scene uses the saved anchors and shows the five asset types together. Headless Chromium reported around 60 FPS on this small canvas, not a game-renderer benchmark.

## Evidence

- [Variant grid](grid.png)
- [Test scene](scene.png)
- [Mixed-variant seam close-up](seam.png)
- [Mobile overlay](mobile.png)
- [Measurements](measurements.json) include each variant’s seed, latency, estimated image cost and seam metric.
- Raw images and prepared PNGs are archived in `apps/www/public/asset-generator/examples/`, with model/role provenance in `index.json`. “Load recorded experiments” opens the first six families without calls; all seven runs remain archived.

Offline verification decodes every sprite, checks dimensions and opacity, verifies matching XY/X edges, and takes headless screenshots. Reprocessing is available with `--prepare`; paid refresh requires explicit `--live`. See [the lab README](../../../apps/www/app/lab/asset-generator/README.md) for reproduction.
