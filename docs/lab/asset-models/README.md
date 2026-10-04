# Small pixel-art asset model research

Research for **evermore-1fo.31**, recorded on 2026-10-04. Recommendations are experimental; this does not change the product's default model.

- [Research report (German)](research.md): comparison, limitations, costs and recommendations.
- [Local gallery](gallery.html): native sources, 16/32/64 px derivatives, original colors versus a common experimental palette, and repeated grass tiles.
- [Comparison sheet](comparison.png): all tested approaches in one image.
- [Measurements](measurements.json): exact model IDs, prompts, usage, timing and reference provenance.

Each successful option has `tree.png`, `house.png` and `grass.png`, with request and response metadata. `*-16/32/64.png` are palette-reduced derivatives; `*-unquantized.png` retain original colors after nearest-neighbor downscaling and sprite background removal. `grass-tiled.png` repeats the 64 px tile 3×3 without seam repair. Source images retain their decoded pixels; JPEG responses are losslessly re-encoded as PNG, not enhanced or painted over.

`flash-reference` is the intentionally retained first reference attempt with no role guidance. `flash-reference-guided` explicitly treats the frozen well as a style reference. Both keep the same primary subject/style text as the text-only runs. `imagen-fast/tree.error.json` and `flash-lite-512/tree.error.json` are failed availability/capability probes, never substitute test images.

Use Node 22 and install repository dependencies first:

```sh
node docs/lab/asset-models/generate.mjs --process-only
node docs/lab/asset-models/gallery.mjs
node docs/lab/asset-models/verify.mjs
```

The following command makes **paid** calls for missing images, using Application Default Credentials and project `maw-evermore` (`GOOGLE_CLOUD_PROJECT` can override it). Existing successful images are reused. Requests are sequential; no retries happen automatically. If a request times out, investigate whether it completed before resubmitting. Select one option to limit generation:

```sh
node docs/lab/asset-models/generate.mjs flash-reference-guided
```

An invocation without arguments generates all missing active options. The deprecated Imagen and unsupported Flash-Lite 512 probes require an explicit option ID and are excluded from the default run. No account tokens are written to artifacts. Request metadata references the well snapshot (the original runs used its repository path) instead of duplicating its base64 payload.

Open `gallery.html` locally. No server, API key, application route or network request is needed to view the archived results.
