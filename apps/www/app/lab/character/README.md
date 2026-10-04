# Character A/B · Paper doll and image model

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

## B · Image model

The same page now opens with the image-model approach. Switch A/B without losing
local variants or controls. B accepts free descriptions, including non-human
characters. A new character uses two selected-model Vertex calls: a reference
portrait, then a regular 4 × 4 walking sheet (south, west, north, east rows).
Text edits use the selected variant's current high-resolution sheet as the
image reference, with one call and instructions to preserve the other details.

`POST /api/lab/character/image` is restricted to loopback development and the
same browser origin. It uses ADC, project `maw-evermore` by default and the global
Vertex endpoint. Flash-Lite (`gemini-3.1-flash-lite-image`), Flash and Pro use the
same price estimates as the object lab. No model or artwork fallback is used.
Errors remain visible; completed calls retain their cost estimates on failure.
Twenty hourly call reservations include failed requests and both stages of a
new character. Reservations happen before asynchronous credential/provider work.

Images are decoded within 2048 × 2048 pixels and 6 MB per PNG. The server retains
at most eight variants and 64 MB per development process. An expired reference
returns 410 without a model call. Browser history retains eight variants and
expires on reload. Nothing is stored in the database.

Preparation removes magenta variations and a narrow 2% cell gutter (model-drawn
separator lines), removes tiny isolated speckles, cuts the equal cells, and applies one
shared crop and scale across the entire sheet. This preserves frame offsets
instead of independently stretching each body. Empty frames and invalid grids
are rejected. The preview uses nearest-neighbor pixel density and a shared adaptive 32-color palette
(default), with optional hearth/dusk world palettes; size, palette and tempo changes make no paid calls.
The movement scene uses `@evermore/core`, walks automatically, and supports
arrow keys/WASD after focusing the canvas. Pause and frame scrubbing affect both
previews. FPS/frame time, raw images, downloads and per-frame dimensions/foot
positions help inspect identity drift; they do not certify semantic consistency.

Run `node scripts/check-character-image.mjs` from `apps/www` against a running
local server (`CHARACTER_CHECK_ORIGIN` defaults to `http://127.0.0.1:9400`). This
explicit live check makes up to eight paid image calls for pirate, smile,
blue-hat edit, donkey and sorceress, saving screenshots and measurements under
`docs/lab/screenshots/character-image-*`. It also checks animation, movement,
preview extremes, retained A/B history, mobile panel overlap and overflow.
Provider failures stop the live sequence and are recorded without invented
results. Unit tests mock provider responses and cover sequencing, references,
shared frame transforms, validation, limits, expiration and failure costs.

Image editing follows the [official Vertex image editing documentation](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/gemini-edit-images).

The live check stores raw responses in ignored `apps/www/.next/character-check`.
Set `CHARACTER_CHECK_REPLAY=true` to rerun preparation and browser checks using
those actual model outputs without further paid calls. Measurements explicitly
mark replayed preparation; original model costs/times stay attached to the data.
The browser checks are opt-in and do not run during `pnpm test`.
