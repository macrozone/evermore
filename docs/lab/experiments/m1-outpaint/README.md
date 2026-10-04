# M1.3 — Beyond the picture

`/lab/m1-outpaint` extends the unchanged it2 evening cabin by one full 1376 × 768 picture to the north, east, south and west. Missing corners and additional rings are closed. This is a focused outpainting experiment next to `/lab/m1-walk`, which is developed separately for M1.1; it does not add interiors or prompt-generated starting worlds.

Focus the world to move with WASD or arrows; touch arrows also work. Within 180 source pixels of an edge, the neighbour starts loading. The feet stop at a missing or still-loading chunk and cross once its image and masks are ready. Saved samples are the default and incur no new model cost. Select **Live local generation** to spend the local model budget on edge proximity. Image and mask selectors offer Flash-Lite, Flash and Pro; both default to Flash-Lite. The four inspected saved samples use Pro images and Flash Vision masks deliberately, because the cheaper image attempts often moved the context strip.

## Pipeline and seam comparison

1. Copy the corresponding **96 px border strip** into a grey padded canvas, with space for a full new picture. East has the old strip at the left, west at the right, north at the bottom and south at the top. Send this single registered canvas to Gemini image editing. The prompt gives the strip's exact percentage and asks for continuous paths/rivers, camera, lighting and pixel scale. [Gemini image editing](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/gemini-edit-images) supports the text-plus-image edit; it does not impose a hard frozen-pixel mask.
2. Record the native output dimensions, register the result to the padded canvas with nearest-neighbour sampling, then cut the **full** new picture and its context strip. The nearest supported aspect ratio can differ slightly from the padded input. Outputs with an incompatible aspect ratio are rejected. Registration fixes output dimensions, not model geometry or the exact original pixel-cluster scale.
3. Extract G3b Vision polygons from the final chunk image, rasterize collision and overhead independently, and apply bridge/door exceptions after solids. The new [structured-output schema](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/control-generated-output) enforces polygon fields, classes and normalized coordinate range. Local validation still bounds polygon/vertex counts and tuples. Very large nested `maxItems` constraints caused Vertex HTTP 400 in live tests, so count limits remain in validation and the prompt.
4. **Pure outpainting** draws the original parent unchanged and the adjacent generated image. **Overlap + blend** fades the model's context strip over the last 96 parent pixels toward the new image. Both modes use exactly the same saved output, with no second model call and no terrain recolouring. Masks remain registered to the original parent and new chunk; blend does not claim to fix misplaced geometry.
5. R2 movement uses global source-pixel coordinates. Every foot pixel is checked on both sides of a seam; negative coordinates use floor division. The original overhead pixels cover the avatar, followed by its 40% silhouette. Overhead redraw is clipped around the avatar so it cannot erase the overlap blend elsewhere.

**Inspect … seam** fixes the camera on the join at 4× zoom, with east/west focused on the path and river and south on the outgoing bridge path. **World overview** shows the complete cross. **Place player** is an explicit inspection aid that only accepts a walkable feet footprint; it is useful for testing remote trees and water, not proof that a path from spawn is reachable.

## Recorded samples (2026-10-04)

All images use `gemini-3-pro-image`; all masks use `gemini-3.8-flash`. Costs are estimates from the existing G3/G3b rates and returned token usage, not invoices. Saved/loading/browser-cache requests cost $0. The recorded duration covers image generation and mask extraction.

| Chunk | Duration | Image estimate | Mask estimate | Total estimate | Native edit output |
| --- | ---: | ---: | ---: | ---: | --- |
| North | 30.261 s | $0.138776 | $0.006608 | $0.145384 | 1264 × 848 |
| East | 40.446 s | $0.139050 | $0.008505 | $0.147555 | 1376 × 768 |
| South | 41.644 s | $0.139352 | $0.010583 | $0.149935 | 1264 × 848 |
| West | 31.092 s | $0.139878 | $0.008569 | $0.148447 | 1376 × 768 |

The four successful saved chunks total approximately **$0.59132**. Earlier rejected picture/mask attempts also incurred cost and are not included in that successful-output total. The UI separates historical chunk cost from successful request cost during the current visit. Failed reservations stay charged against the local estimated reservation budget.

Raw chunk pixels, context strips, Vision polygons, models, costs and timestamps are in `apps/www/public/m1-outpaint`. IndexedDB persists successfully loaded/generated chunks per mode and selected model pair. A storage error keeps the world playable and offers JSON export. Exported saved records refer to their committed public image files; generated records contain their image data. No storage write, provider request or budget reservation occurs before the local/same-origin route gate accepts a live POST. Arbitrary image URLs are not fetched.

## Findings

Providing the whole cabin as a second reference often made Flash-Lite redraw the cabin instead of preserving a geographic strip. Removing that reference improved the instruction, but Flash-Lite still changed lighting, river position and pixel scale. Flash followed the source style better and produced valid masks, yet sometimes expanded the small context strip into a separate panel with an internal hard boundary. Explicit strip percentages with Pro produced the strongest inspected four-direction set: the east/west path and river continue, and the south bridge path leads into a new clearing. Pro also keeps the large source trees closer in scale and avoids the internal reference panel in these samples.

The overlap method reduces abrupt changes at the join but can produce double contours when the generated context moves a tree or roof. Pure is useful for spotting that registration error. Neither method guarantees seamless results for arbitrary future generations; the saved four-direction set is an inspected example, not an autonomous seam validator. Vision masks remain drafts: some crowns have broad footprints and trunk regions can be inaccurate. A geometry correction workflow remains relevant from G3b.

Live requests reserve before either provider call: at most **8 attempts / $3 estimated reservations per rolling hour**. This accommodates four conservative Pro reservations while keeping a bounded local experiment. Failed calls retain their reservation. Concurrent identical complete requests share work; successful complete chunks are cached. If image generation succeeded but masks failed, a retry reuses the paid image and reports only the new mask cost for that request. Caches and budgets are process-local; restarting development resets them. Changing settings while a chunk loads is disabled.

## Validation and reproduction

Node 22.23.3: monorepo typecheck, lint, full tests and production build. Unit tests cover directional canvas placement/cropping, source bounds, provider selection/errors, reservation exhaustion/reset, cache isolation/deduplication, image reuse after mask failure, costs, structured masks, same-origin/body limits, cross-boundary collision, missing chunks, negative coordinates, overhead and prefetch.

Start the app in the bead's worktree and use the localhost origin:

```sh
pnpm --filter @evermore/www dev --webpack --port 9600
node scripts/check-m1-outpaint.mjs http://localhost:9600
node scripts/record-m1-outpaint.mjs http://localhost:9600
```

The headless check delays the saved east response to inspect loading and verifies that missing chunks stop the feet, then walks from the original path into the east chunk. It checks collision and 40% overhead silhouette inside the new tile, pure-mode parent pixels, all four loaded neighbours, both enlarged seam methods, IndexedDB restore without model POSTs, and simultaneous mobile world/controls. Coordinates and assertions are in [checks.json](checks.json).

Only regenerate samples when deliberately spending the local budget:

```sh
node scripts/generate-m1-outpaint-samples.mjs http://localhost:9600 --replace --image-model=gemini-3-pro-image --mask-model=gemini-3.8-flash
```

`--directions=east,south` narrows regeneration. Existing records are skipped unless `--replace` is supplied. No provider fallback is used.

Artifacts: [headless crossing video](east-crossing.webm), [overview](world-overview.png), [loading](loading.png), [east pure](east-pure-seam.png), [east blend](east-blend-seam.png), [north blend](north-blend-seam.png), [south blend](south-blend-seam.png), [west blend](west-blend-seam.png), [new-chunk collision](new-chunk-collision.png), [new-chunk overhead](new-chunk-overhead.png), [east masks](east-masks.png), and [mobile](mobile.png). Pure/blend captures for every direction are included alongside these links.
