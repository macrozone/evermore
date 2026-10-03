# Live object lab

Open `/lab/objects` in a local Next development server. Describe one object,
choose Flash-Lite (default), Flash or Pro, a seed and 2–4 variants. Optionally
set the sprite width/height in 16 px tiles. Pixel size and palette are applied
by the same deterministic Sharp pipeline used by the offline library scripts.
Both generation paths attach the existing well image as a shared library style
reference to reinforce camera direction and palette. Generated cards compare the raw model image and prepared transparent sprite.
Footprints, collisions and height are **heuristic estimates** based on kind and
size; review them before placing the object in a world.

The browser never receives credentials. Set `GOOGLE_CLOUD_PROJECT` if needed
(default `maw-evermore`) and run `gcloud auth application-default login` locally.
The route uses the global Vertex endpoint and the selected model, without
silently changing models on an error. Production, foreign hosts and cross-origin
requests are rejected before credential lookup. Next's normalized localhost
request URL and injected forwarded Host header are accounted for.

The development process allows 20 reserved image attempts in a rolling hour,
including failed attempts. Each variant consumes one attempt. Matching complete
settings reuse a bounded process-wide LRU cache, including concurrent requests.
An expanded variant count reuses existing seeds and only generates missing ones.
The counter refreshes every 30 seconds and after a generation request. Restarting
the dev server resets the budget and cache; this is a local lab guard, not a
public production quota. Seeds are hints to the model, not a guarantee of
identical images after cache eviction or a provider update.

Costs are estimates in USD using [Vertex standard global pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing)
checked on October 3, 2026: 1K image output plus input and reported text/reasoning
usage. A cache hit incurs no additional model cost; cards retain the original
creation cost and latency for comparisons. A successful image that fails sprite
preparation can still cost money and is counted in the request estimate.

“Add to local library” persists the raw image, prepared PNG and estimated
metadata in this browser's IndexedDB. PNG and JSON downloads provide an export.
Nothing writes into the repository library. Generation controls and results
have independent scroll panes, including a stacked layout on narrow screens.

Validation:

```sh
pnpm --filter @evermore/www exec vitest run app/api/lab/objects/generate.test.ts
pnpm --filter @evermore/www exec node scripts/check-objects.mjs
pnpm screenshot /lab/objects
```

The headless interaction check starts an isolated dev server, checks the actual
local status route, then uses fixture generation responses (no paid model calls)
to check variants, extreme settings, desktop/mobile scrolling, PNG/JSON downloads,
local persistence and rate-limit feedback.

Live smoke test (October 4, 2026): two Flash-Lite well variants with the library
reference completed in 8.559 s, estimated $0.067844 total. Repeating the same
settings returned a cache hit at $0 and left the counter at 2/20. The reference
fixed the roof-perspective drift observed with a text-only style prompt.
See the [desktop view](../../../../../docs/lab/screenshots/objects-desktop.png),
[raw example](../../../../../docs/lab/screenshots/objects-raw-0.png) and
[prepared sprite](../../../../../docs/lab/screenshots/objects-live-0.png).
