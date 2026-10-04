# G3b — Walk on the original picture

`/lab/g3b-map` compares registered collision and overhead masks on the unchanged it2 forest cabin and harbour images. The picture itself is the ground layer. Its overhead pixels are copied above the R2 avatar; a second avatar pass at 40% opacity keeps it visible behind roofs. There is no material recolouring, inferred terrain, inpainting, interior, or world extension in this slice.

The page switches between saved model outputs and local live extraction, with independent collision/overhead overlays, a 16 px grid, pixel vs. conservative 16 px collision, and zoom. WASD/arrows use the shared R2 movement engine and a feet footprint; touch arrows also work. Map and controls remain together on mobile. Optional source-pixel brush strokes correct either mask, clear either class, or clear both. Edits are session-local and can be restored to the original model output.

## Two approaches on the same sources

| Source | Approach | Model | Recorded duration | Recorded estimate |
| --- | --- | --- | --- | --- |
| Cabin | Image edit | `gemini-3.1-flash-lite-image` | 19.689 s | $0.033925 |
| Cabin | Vision polygons | `gemini-3.5-flash-lite` | 11.369 s | $0.003244 |
| Harbour | Image edit | `gemini-3.1-flash-lite-image` | 6.543 s | $0.033925 |
| Harbour | Vision polygons | `gemini-3.5-flash-lite` | 6.608 s | $0.0032215 |

A separate live UI check generated a square 1024 × 1024 clearing/cottage source in 6.338 s (~$0.0336), then extracted 15 Vision regions in 7.403 s (~$0.0036435). It also verifies that square maps stay within the shared map/control stage. A denser generated forest exhausted the earlier 8192-token limit and showed a clear incomplete-output error; the final extractor allows 16384 output tokens with a matching reservation and asks for compact polygons.

Samples in `apps/www/public/g3b-map` are original successful model outputs from 2026-10-04, with source size, model, duration and estimated cost. Recorded Vision estimates used the initial $0.25/$1.50 per million input/output heuristic; they are retained as historical estimates, not invoices. New live Vision estimates use the [published global rates](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing), checked 2026-10-04: Flash-Lite $0.30/$2.50, Flash $0.75/$3.75 (introductory through 2026-12-31), Pro $2/$12. Image estimates reuse G3's pricing. The recorded estimates suffice to distinguish the order of magnitude, not to compare exact billing. Cached/saved outputs incur no new model cost. Only Flash-Lite was exercised live for these baseline samples; the selector also offers Flash and Pro without silently falling back.

**Image edit:** white = free, black = collision, red = overhead, magenta = both. Nearest canonical colour tolerates antialiasing. Output dimensions and aspect ratio are checked; matching-aspect outputs are resized with nearest-neighbour sampling to source dimensions, with the original output size retained. Equal dimensions do not prove semantic registration: the model can still move an edge.

**Vision:** classified polygons use absolute normalized 0–1000 image coordinates. They are rasterized to independent binary masks. Explicit door/bridge exceptions clear collision after solids, without clearing overhead. These are object polygons, not a claim of pixel-accurate segmentation.

**16 px comparison:** any blocked source pixel blocks its entire cell, including partial edge cells; overhead uses the same reduction. This prevents small obstacles disappearing but can close narrow passages and expands an already inaccurate region. It does not improve model semantics.

## Findings and recommendation

Vision is the stronger starting point for **collision** in these two samples. The cabin river blocks movement, its bridge exception remains traversable, and its building wall stops the feet. The harbour separates the bridge decks and doors, but the central house rectangle includes the roof and blocks too much ground. Many tree crowns and the entire cabin vegetable patch become solid rectangles; tree trunks are not reliably separated from crowns. It misses overhead classes on most trees. The cabin roof rectangle covers empty space above the roof, so even an apparently correct silhouette can occur before the real eave. A successful movement test demonstrates the mask consumer, not verified map geometry.

Image edit gives more convincing **visible contours** for the cabin roof, house, fences and plants. It still fails critical semantics: river/harbour water is mostly white (walkable), dark paths gain thin black outlines, windows become collision, and the harbour door remains blocked. The cabin bridge is red overhead despite being a deck. Large forest areas become magenta and some foreground crowns black. These masks cannot be used unchanged as authoritative collision geometry.

Use Vision polygons as an inspectable collision draft and image masks as an overhead/edge draft, then correct or verify the results. The experiment keeps both raw outputs accessible, rather than concealing mistakes with source-specific overrides. The optional brush makes corrections directly comparable. Neither approach is ready for autonomous playable-world generation. Better prompts/models or verified object footprints belong in the next M1 slice; interiors and outpainting remain outside this bead.

## Reproduce and inspect

Start the local app in this worktree. Use the `localhost` origin printed by Next.js; its development origin guard can block browser resources when the server is accessed as `127.0.0.1`. For headless captures and movement/layout assertions:

```sh
node scripts/check-g3b-map.mjs http://localhost:<BASE_PORT>
pnpm screenshot '/lab/g3b-map?source=cabin&approach=vision' --wait 3000 --out docs/lab/experiments/g3b-map/cabin-vision.png
```

Regenerate baseline samples only when deliberately spending the local lab budget:

```sh
node scripts/generate-g3b-samples.mjs http://localhost:<BASE_PORT>
node scripts/check-g3b-live.mjs http://localhost:<BASE_PORT>
```

Local live APIs require development mode and a same-loopback origin before ADC is used. Source images are fixed local moodboards or bounded inline generated images, never fetched arbitrary URLs. Mask extraction reserves a separate $1/hour estimate budget, at most 16 calls, before provider requests; failures retain their reservation. Identical in-flight calls are shared and successful results are cached with bounded eviction. Reservations are process-local estimates, not a billing cap. Map generation reuses G3 and has its own budget.

Unit tests cover masks, bridge/door precedence, cell reduction, movement, edge bounds, safe spawn, occlusion, brush continuity, provider output validation, source registration, cache isolation/deduplication, budget exhaustion/reset, failure retention, and local request boundaries. The headless check compares every source pixel outside the avatar, exercises diagonal/cardinal movement, wall/water stops, bridge crossing and roof occlusion, then checks brush restoration, zoom extremes and simultaneous mobile map/controls.

Artifacts: [cabin Vision](cabin-vision.png), [cabin image edit](cabin-image.png), [harbour Vision](harbour-vision.png), [harbour image edit](harbour-image.png), [behind roof](player-behind-roof.png), [water edge](player-water-edge.png), [mobile grid](mobile-grid.png), [movement coordinates](checks.json), [live generated source](live-vision.png), and [live request metadata](live-checks.json).
