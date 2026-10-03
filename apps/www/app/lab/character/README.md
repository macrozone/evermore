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
