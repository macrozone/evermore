# Asset generator experiment

`/lab/asset-generator` turns one free description and a seed into a ten-variant 2D bitmap family. It is an experiment for evermore-1fo.32, not a world-format or art-direction decision.

- The text model returns a Zod-validated technical role: **surface** (opaque, repeating XY), **object** (transparent, ground anchor), or **strip** (transparent, repeating X). There is no fixed subject list. Width/height are 1–8 tiles, with 16 pixels per tile. Anchors are normalized to the prepared sprite rectangle.
- The inferred parameters are visible and editable. “Derive role only” avoids image calls. Changes apply to the next batch; existing scene families retain their saved parameters.
- Model selectors default to Gemini 3.5 Flash-Lite for text and Gemini 3.1 Flash-Lite Image for images. Three strategies compare independent images, a fixed first-image reference, and one image with deterministic mirrored/color variants. Procedural variants have no additional model charge. They do not create new silhouettes or guarantee a consistent lighting direction when mirrored.
- Pixel art uses a textual style anchor based on the Art Bible and moodboard `02-eigene-welt` it2. It intentionally does not send the well reference: the previous model research found subject copying. Style consistency remains an empirical judgement.
- Images are generated at 1K and prepared with nearest-neighbor scaling. Border-connected magenta becomes alpha for objects/strips. A missing background or empty cutout fails visibly instead of returning an opaque square. Muted purple interiors are preserved; enclosed gaps in the reserved pure key color also become transparent; objects touching the reserved background color can still need manual review.
- Surface variants share the first successful image's periodic XY border, an eight-pixel blending band and family mean-color normalization. Strips share X borders. This prevents hard color/alpha jumps between family members. Repeated motifs and differing interiors can still look artificial; inspect the mixed-variant seam preview. Raw images are preserved for comparison. Different surface families occupy separate ground patches; this experiment does not generate cross-material autotiles.
- The canvas scene mixes up to six families, repeating terrain and drawing transparent sprites in ground-anchor depth order. FPS measures this preview, not the game renderer. Desktop controls stay visible while scrolling; small-screen controls float above the preview.

## Local live calls

Start `apps/www` in development with local Application Default Credentials (`gcloud auth application-default login`). The API rejects production, remote hosts, forwarded requests and cross-origin POSTs before looking up credentials. `GOOGLE_CLOUD_PROJECT` defaults to `maw-evermore`. No credentials reach the client.

The development process reserves up to 100 image calls and 120 text calls per rolling hour, including failed attempts/reservations. A batch uses ten reservations, or one with procedural variation. Requests run images sequentially; identical in-flight requests are deduplicated. Successful batches are cached in a 32 MiB / 20-entry process cache; role inference has a 100-entry cache. A seed fixes requests and procedural processing, not the provider's output after cache eviction/restart. Failed batches retain their successful variants and show errors; retrying a partial batch regenerates the whole family.

The cards show historical per-variant cost and provider/preparation latency. The batch total is the estimated cost incurred by that request, including uncached role inference; cache hits cost zero. Prices use global standard token rates checked 2026-10-04 ([Google pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing)), excluding credits/taxes. Inference uses measured usage; image cost uses reported image tokens or the model's 1K estimate if absent.

## Recorded experiments and verification

“Load recorded experiments (no calls)” loads the archived live outputs from `public/asset-generator/examples/`. It is available without credentials and does not pretend to be fresh generation. No browser storage is used. See `docs/lab/asset-generator/` for measurements and headless screenshots.

With a local development server running:

```sh
# Offline: verify recorded output metadata and capture grid, scene, seam and mobile.
ASSET_TEST_ORIGIN=http://127.0.0.1:31132 node apps/www/scripts/check-asset-generator.mjs

# Reprocess archived raw images with the current preparation pipeline, no model calls.
ASSET_TEST_ORIGIN=http://127.0.0.1:31132 node --experimental-strip-types apps/www/scripts/check-asset-generator.mjs --prepare

# Explicitly paid: refresh five descriptions and two additional strategy runs.
ASSET_TEST_ORIGIN=http://127.0.0.1:31132 node apps/www/scripts/check-asset-generator.mjs --live

pnpm --filter @evermore/www exec vitest run app/api/lab/asset-generator/generate.test.ts
```

The live script archives ten sprites and ten raw images per run, exact model/seed/role, per-variant latency/cost and batch errors. It uses headless Chromium only and verifies that five distinct descriptions exist, each family has ten successes, and tiled output edges match.
