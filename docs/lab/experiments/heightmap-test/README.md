# Test: image model draws a height map for its own image (2026-10-03)

Idea by maw (epic evermore-1fo.17): the image model generates a color-coded height map for a pixel-art image, so we do not have to guess heights.

- Source: `docs/art/moodboards/02-eigene-welt/it2-waldhuette-abend.jpg` (1376×768)
- Model: `gemini-3.1-flash-image` via Vertex AI (location `eu`), image-to-image with a reference image
- Result: `it2-waldhuette-abend.height.png` (1376×768, same size)
- Cost: approx. 1,240 input and 1,730 output tokens (1 image)

## Prompt

> Create a HEIGHT MAP for this exact top-down pixel-art game scene. Same framing, same size, same layout, pixel-aligned to the input. Encode height as flat grayscale steps: black = water (lowest), dark gray = ground/grass, mid gray = paths, fences and low objects (knee height), light gray = walls and tree trunks (one storey), near-white = roofs and tree crowns, white = chimney/highest points. No shading, no lighting, no texture, no outlines, no text - only flat gray regions with hard edges matching the objects in the input image.

## Observations

- **Aligned:** layout, objects and edges match the original very closely (house, fence, stream, bridge, trees).
- **Height logic roughly right:** water black (lowest), ground dark, paths/fence mid, roofs and tree crowns light.
- **Not flat:** the model drew more of a grayscale version with textures than clean height steps. Voxels need post-processing (per-tile quantization to the steps, smoothing) or a stricter prompt / second pass.
- Facades (front house wall) are sometimes as light as roofs – in a top-down view, "height" is ambiguous for facades; facades should rather be derived from the roof→ground edge.

Conclusion: promising as a source for heights; test with quantization for the prototype evermore-1fo.17.2.
