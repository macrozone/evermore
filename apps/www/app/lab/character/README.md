# Character A · Paper doll

`/lab/character` is an isolated comparison of text-model part selection and
deterministic pixel layers. The available body, hair, outfit, accessory and
five base colours share a versioned, strictly validated specification. Four
directions and four walk phases use the same doll; side views mirror the
complete character, including accessories.

The model selects existing parts; it does not create artwork. Unsupported
details need more parts. The 16, 24 and 32 pixel grids intentionally expose
how small features disappear at lower density. Display size is an independent
integer scale. Colours, parts and preview settings can be copied as JSON.

`POST /api/lab/character` uses server-side Google Application Default
Credentials, following the book generator. The default text model is
`gemini-3.5-flash-lite`; Flash and Pro are selectable. Set
`CHARACTER_VERTEX_LOCATION` to override the default `eu` endpoint, and
`GOOGLE_CLOUD_PROJECT` to override `maw-evermore`.
Unavailable credentials, provider failures or invalid output return a clearly
labelled finite example. `CHARACTER_VERTEX_DISABLED=true` forces examples for
repeatable offline review. Initial load and the preset selector never call a
model. No character is persisted.

Inspect the silhouette, feet, hair and accessories across all directions.
Pause the animation and scrub frames to examine each pose. This local
experiment does not choose the game's character renderer or art production
pipeline.

## Character C · Voxel comparison

The Rendering selector switches between A and C without changing the part
specification, colours, density or selected pose. C builds solid voxel volumes
with shoulder and hip pivots, rotates the limbs for a four-pose walk, and bakes
four orthographic views into transparent sprites. Exterior faces are shaded by
world-fixed warm directional light and rasterized with a CPU depth buffer;
there are no WebGL contexts or additional model calls. Sprites are baked when
settings change, then replayed from memory. The performance line distinguishes
browser animation FPS, frame time, bake time per sprite and rasterized triangles
from GPU draw calls (zero).

Camera elevation and ambient/sunlight controls expose depth, blockiness and
view-dependent loss of small details. The copied JSON includes rendering mode
and all camera/light parameters. This is a local rendering experiment: it still
has A's finite human parts and does not address free-form creatures or the
image-model artwork explored by B. It does not integrate character lighting
into the R1 world or choose a production pipeline.

Run `LAB_ORIGIN=http://127.0.0.1:<port> node scripts/check-character-voxel.mjs`
against a running dev server for headless interaction proof. With no override,
it reads the generated `.env.local` port. Checks cover animation over time,
pause/scrub, camera and light effects, parts/colours, all density/size extremes,
JSON export, switching back to A and scroll/mobile bounds. Screenshots are in
`docs/lab/screenshots/character-voxel*.png`.
