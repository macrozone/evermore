# M1.2 · Enter the forest cabin

Open `/lab/m1-walk`. Focus the picture, walk with WASD/arrows to the gold
ring at the cabin door, then press E/Enter or **Enter cabin**. Inside, return
to the south doorway and use **Leave cabin**. Touch arrows and the same
button work without a keyboard. The short fade pauses movement. Re-entry
keeps the same room image, masks and ID, and makes no model calls.

The source is the unchanged `it2-waldhuette-abend.jpg`. Ground is the exact
picture, with its masked pixels composited above the R2 avatar and a 40%
silhouette when occluded. There is no material-grid redraw or inpainting.
The integrated page is linked from the shared home/lab catalog.

## Generation and provenance

`POST /api/lab/m1-walk` accepts only the shared image and vision model IDs.
It reads the fixed cabin reference locally, passes those bytes to the image
model, then passes the generated interior to Vision for wall/furniture
polygons and an explicit `exit-door` region. The room ID hashes source bytes,
both models and both instructions. Four process-cache entries and pending
request deduplication preserve complete image/mask pairs. A pipeline reserves
both calls before starting; failed calls retain reservations. Limits are
eight pipelines and $1 in estimated reservations per rolling hour (the cost
limit can exhaust first). This is an estimate, not a billing cap. Same-origin
loopback development checks run before parsing or credentials.

The saved sample uses `gemini-3.1-flash-lite-image` (8.478 seconds,
~$0.033600, image-only estimate) and `gemini-3.5-flash-lite` (7.060 seconds,
~$0.002621, usage estimate), for ~15.5 seconds of model time and ~$0.036221.
The original image and all original polygons/metadata are retained in
`apps/www/public/m1-walk/cabin-interior.json`; the PNG is an exact decode of
its base64 image, included for inspection.

The first mask enclosed the entire room in one blocked rectangle. The
instruction now requires separate narrow wall strips. The server also
rejects a result without an exit or with less than 8% of the image reachable
from the doorway on a 4-pixel probe grid. This catches that failure, but does
not prove semantic accuracy. Failures preserve the previous playable room.

Even the improved output misplaced the fireplace onto the lower-right floor
and approximated furniture poorly. The saved sample therefore has explicit
`reviewedRegions` for the fireplace, bed, table, chairs and east bookshelf.
The original `mask.regions` remains untouched. The UI states that these are
reviewed annotations. Live results use their original polygons, plus the
same small explicit threshold correction; they are approximate and have a
local correction brush. Door rings can be moved by clicking the picture.
Door markers are annotations, not claimed automatic door detection.

## Controls and evidence

The panel and world stay visible together, with independent scrolling in
the panel. Zoom ranges from 0.5 to 3, and square images fit the available
viewport at 1×. Pixel and conservative 16-pixel collision, collision/overhead
previews, grid, door marking, brush correction, reset and settings JSON are
available. FPS and mean frame time are sampled from the actual animation
loop. Model selectors affect the next explicit generation, not re-entry.

Headless reproduction, using Node 22 from the repository root:

```sh
pnpm catenv
BASE_PORT=$(node --env-file=.env.local -p 'process.env.BASE_PORT') pnpm --filter @evermore/www dev
# In another terminal, use the port printed above:
node scripts/check-m1-walk.mjs http://localhost:<port>
node scripts/check-g3b-map.mjs http://localhost:<port> /tmp/g3b-regression
pnpm screenshot /lab/m1-walk --wait 1500 --out docs/lab/experiments/m1-walk/reference.png
```

To replace the original saved sample with a new model result:

```sh
node scripts/generate-m1-interior.mjs http://localhost:<port>
```

This calls both models and overwrites the saved sample, including discarding
its reviewed annotations. Inspect the output before committing. Changes to
provider instructions require restarting the dev server because the bounded
generator is held process-wide. Stop the dev server before `next typegen` or
a production build, then restart it before browser verification.

The browser check records movement, entry proximity, a real fade, collision,
return position, repeated-entry room identity and zero POST calls, selectors,
brush/door interaction, zoom extremes, conservative threshold clearance,
scroll/mobile layout, continued rendering and page errors in `evidence.json`.
Screenshots cover start, exterior door, interior, interior collision,
interior masks, exterior return, zoom extremes, scroll and mobile.

Art Bible review: axis-aligned pixel art, compact cozy home, warm window and
fireplace light, timber/stone continuity and legible avatar silhouette.
Open for maw's visual feedback: the image model kept some forest around the
cutaway and slightly changed the apparent pixel density/room scale. The
sprite currently retains R2's source-pixel size. The reviewed furniture
bounds and explicit doorway are an experiment, not production geometry.

Validation on Node 22.23.3: install, repository typecheck, lint, production
build and full `pnpm test` passed (www: 358 passed, one pre-existing live test
skipped). Final screenshots and interaction evidence were captured against
the production build, with the live endpoint correctly disabled there;
the real Vertex sample was generated in local development. The shared G3b
headless suite also verifies its original source pixels, water/wall/bridge
collision, overhead silhouette, brush, zoom and mobile behavior.
