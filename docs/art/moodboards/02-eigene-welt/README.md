# Moodboard 2 – Own World

The player's own world is their home: warm, familiar and alive – a forest cottage, a fisherman's house or a camp in desert ruins, depending on the player's description. Light tells the mood – window light, lanterns, campfires and oil lamps cast visible warm pools of light into cooler surroundings. The look is pixel art with an SNES feel, but done in a modern way: soft dynamic light, directional shadows, particles (fireflies, sparks, pollen). Coziness as in *Stardew Valley*, light and particle work as in *Children of Morta*. The same places appear in [Board 4 – Shadow World](../04-schattenwelt/README.md) as a distorted mirror image.

Moodboards are append-only: every iteration is kept and shows how the direction evolved.

## Iteration 2 (2026-10-03, axis-aligned top-down view)

Feedback from maw: no 45° isometry, but an axis-aligned top-down view like *Stardew Valley*, *Secret of Mana*, *Zelda: A Link to the Past* (orthographic, looking from the "south", edges horizontal/vertical, roofs and facades visible).

| Image | Description |
|---|---|
| `it2-waldhuette-abend.jpg` | Thatched forest cottage in the evening, warm window and lantern light on path and meadow, stream with bridge, vegetable garden, fireflies. |
| `it2-waldhuette-tag.jpg` | The same scene on a sunny late morning with short shadows, dappled light under the trees, butterflies and sparkles on the stream. |
| `it2-hafenstadt-abend.jpg` | Stone fisherman's house on the quay, jetty with lanterns and two boats, fish-drying rack, nets and seagulls in the evening blue. |
| `it2-wuestenruine-nacht.jpg` | Homely sandstone ruin with rugs, cushions, tea table, oil lamps and campfire, surrounded by moonlit dunes. |

Note: in `it2-wuestenruine-nacht.jpg` the dunes and starry sky at the edges are seen more from the side, while the ruin itself is top-down – the perspective is not fully consistent.

## Iteration 1 (2026-10-03, 45° isometric)

| Image | Description |
|---|---|
| `waldhuette-abend.jpg` | Forest cottage in the evening with garden, stream, bridge and lantern, crescent moon above the forest (pre-existing, prompt not documented). |
| `waldhuette-tag.jpg` | The same forest cottage on a sunny late morning with light rays through the trees and a flower meadow. |
| `hafenstadt-abend.jpg` | Fisherman's house on a wooden pier by the sea at dusk, lanterns, boats, seagulls, warm window light. |
| `wuestenruine-nacht.jpg` | Home in desert ruins at night with campfire, rugs, oil lamps and starry sky. |

## Color mood

Dominant colors computed with median cut (Pillow) over all images of the board; light accents estimated from the images.

| Hex | Role |
|---|---|
| `#234B55` | night green/petrol (shadows, water, evening meadow) |
| `#120E29` | deep night indigo (sky, sea) |
| `#18478F` | stream blue |
| `#6CA652` | rich meadow green (day) |
| `#87513F` | wood, timber framing, jetty |
| `#CC7442` | terracotta, bricks, pumpkin |
| `#B0B158` | thatched roof, sand |
| `#F2A43A` | warm lamp/fire light (estimated) |

## References

- *Stardew Valley* – coziness, home, garden; axis-aligned top-down view
- *Secret of Mana*, *Zelda: A Link to the Past* – SNES top-down view, facades and roofs visible
- *Children of Morta* – dynamic light, shadows, particles on pixel art
- Art Bible: [`docs/art/README.md`](../../README.md), Vision section 5

## Prompts

Generated with `create_asset` (media-pipeline, model `gemini-3-pro-image-preview`), aspect ratio 16:9. The images are JPEG (`.jpg`); the tool had named them `.png`, renamed on 2026-10-03.

### Iteration 2

**it2-waldhuette-abend.jpg**
> Video game environment scene: a small thatched-roof timber-framed forest cottage with stone base and chimney, wooden front door facing the viewer with a hanging lantern beside it, rain barrel at the side, a fenced vegetable garden with pumpkins, cabbages and carrots to the right of the house, wildflowers in the grass, a blue stream running horizontally across the lower part of the scene crossed by a small wooden plank bridge, a dirt path from the door straight down to the bridge, deciduous trees and pine forest all around. Time: evening dusk, sky not visible or only as color in the light, warm orange light glowing from the windows and the lantern, casting visible pools of warm light on the ground, cool blue-violet evening shadows elsewhere, fireflies and a wisp of chimney smoke. Cozy, safe, homey. PERSPECTIVE (important): axis-aligned top-down view like Stardew Valley, Secret of Mana and Zelda: A Link to the Past — orthographic, camera looking down from the south at a steep angle, all edges strictly horizontal and vertical, house front facade and roof both visible, NOT isometric, NOT 45-degree diagonal, no diagonal grid, no vanishing point. Style: pixel art reminiscent of 16-bit SNES action RPGs, but modern: soft dynamic lighting with visible light falloff, cast shadows and particles like in Children of Morta, coziness like Stardew Valley. Uniform pixel density across the whole scene, crisp sharp pixels, no blur, no smoothing. No text, no letters, no UI, no HUD. 16:9 widescreen.

**it2-waldhuette-tag.jpg**
> Video game environment scene: a small thatched-roof timber-framed forest cottage with stone base and chimney, wooden front door facing the viewer with a hanging lantern beside it, rain barrel at the side, a fenced vegetable garden with pumpkins, cabbages and carrots to the right of the house, wildflowers in the grass, a blue stream running horizontally across the lower part of the scene crossed by a small wooden plank bridge, a dirt path from the door straight down to the bridge, deciduous trees and pine forest all around. Time: sunny late morning, bright warm sunlight, crisp short shadows cast by trees, house and fence, dappled light through the leaves, sparkling highlights on the stream, butterflies and floating pollen particles, a thin wisp of chimney smoke. Fresh greens, warm golden light, cheerful and cozy. PERSPECTIVE (important): axis-aligned top-down view like Stardew Valley, Secret of Mana and Zelda: A Link to the Past — orthographic, camera looking down from the south at a steep angle, all edges strictly horizontal and vertical, house front facade and roof both visible, NOT isometric, NOT 45-degree diagonal, no diagonal grid, no vanishing point. Style: pixel art reminiscent of 16-bit SNES action RPGs, but modern: soft dynamic lighting, cast shadows and particles like in Children of Morta, coziness like Stardew Valley. Uniform pixel density across the whole scene, crisp sharp pixels, no blur, no smoothing. No text, no letters, no UI, no HUD. 16:9 widescreen.

**it2-hafenstadt-abend.jpg**
> Video game environment scene: a small cozy fisherman's house with a tiled roof and a crooked chimney in a little harbor town, front facade facing the viewer, standing on a stone quay. A wooden jetty runs straight down from the quay into the sea at the bottom of the scene. Nets, crates, barrels, ropes and a fish-drying rack beside the house, potted plants by the door. Lanterns on posts along the jetty cast warm pools of light on the planks and reflect in the dark water. Two or three small wooden fishing boats moored at the jetty. Warm yellow-orange light glowing from the house windows, spilling onto the cobblestones. Neighboring harbor houses left and right with lit windows. Seagulls perched on posts and flying. Time: evening dusk, cool blue-violet water with shimmering reflections of the lanterns, fireflies or floating ember particles near the lanterns. Cozy, peaceful, homey. PERSPECTIVE (important): axis-aligned top-down view like Stardew Valley, Secret of Mana and Zelda: A Link to the Past — orthographic, camera looking down from the south at a steep angle, all edges strictly horizontal and vertical, house front facades and roofs both visible, NOT isometric, NOT 45-degree diagonal, no diagonal grid, no vanishing point. Style: pixel art reminiscent of 16-bit SNES action RPGs, but modern: soft dynamic lighting with visible light falloff, cast shadows and particles like in Children of Morta, coziness like Stardew Valley. Uniform pixel density across the whole scene, crisp sharp pixels, no blur, no smoothing. No text, no letters, no signs with writing, no UI, no HUD. 16:9 widescreen.

**it2-wuestenruine-nacht.jpg**
> Video game environment scene: a cozy home built inside ancient sandstone desert ruins at night. Crumbling sandstone walls running horizontally and vertically and broken columns with carved patterns form a partially roofed shelter at the top of the scene, with a canvas awning stretched between pillars. In the courtyard below: layered colorful woven rugs in red, ochre and indigo, cushions, a low wooden table with a teapot, clay pots and baskets, a sleeping mat, hanging brass oil lamps and small oil lamps on ledges glowing warm orange. In the center of the courtyard a crackling campfire with rising sparks and embers, casting a warm flickering circle of light and soft shadows across the sand and walls. A date palm and desert shrubs, sand dunes at the edges. Clear night, cool blue moonlight on the sand contrasting with the warm firelight, a few twinkling star-like glints. Cozy, safe, magical. PERSPECTIVE (important): axis-aligned top-down view like Stardew Valley, Secret of Mana and Zelda: A Link to the Past — orthographic, camera looking down from the south at a steep angle, all edges strictly horizontal and vertical, wall fronts and tops both visible, NOT isometric, NOT 45-degree diagonal, no diagonal grid, no vanishing point. Style: pixel art reminiscent of 16-bit SNES action RPGs, but modern: soft dynamic lighting with visible light falloff, cast shadows and particles like in Children of Morta, coziness like Stardew Valley. Uniform pixel density across the whole scene, crisp sharp pixels, no blur, no smoothing. No text, no letters, no UI, no HUD. 16:9 widescreen.

### Iteration 1

**waldhuette-abend.jpg** – pre-existing, prompt not documented.

**waldhuette-tag.jpg**
> Video game environment scene: a small thatched-roof timber-framed forest cottage with stone base and chimney, wooden door with a hanging lantern, rain barrel at the side, a fenced vegetable garden with pumpkins, cabbages and carrots to the right, wildflowers in the grass, a winding blue stream in the foreground crossed by a small wooden plank bridge, a dirt path from the door to the bridge, surrounded by deciduous trees and pine forest. Time: sunny late morning, bright warm sunlight from the upper left, crisp short shadows cast by trees, house and fence, dappled light through the leaves, sparkling highlights on the stream, butterflies and floating pollen particles, a thin wisp of chimney smoke, clear blue sky with a few soft clouds. Fresh greens, warm golden light, cheerful and cozy. Style: pixel art reminiscent of 16-bit SNES action RPGs, but modern: soft dynamic lighting, cast shadows and particles like in Children of Morta, coziness like Stardew Valley. Three-quarter top-down view (classic action RPG perspective, looking down at an angle). Uniform pixel density across the whole scene, crisp sharp pixels, no blur, no smoothing. No text, no letters, no UI, no HUD. 16:9 widescreen.

**hafenstadt-abend.jpg**
> Video game environment scene: a small cozy fisherman's house with a slanted tiled roof and a crooked chimney in a little harbor town by the sea, standing at the edge of a wooden pier. Nets, crates, barrels, ropes and a fish-drying rack beside the house, a few potted plants by the door. Lanterns on posts along the wooden jetty cast warm pools of light on the planks and reflect in the dark water. Two or three small wooden fishing boats moored at the jetty, gently bobbing. Warm yellow-orange light glowing from the house windows, spilling onto the ground. Neighboring houses of the harbor town in the background with lit windows, a stone quay wall. Seagulls perched on posts and flying. Time: evening dusk, sky fading from orange-pink at the horizon to deep blue-violet, first stars, calm sea with shimmering light reflections, fireflies or floating ember particles near the lanterns. Cozy, peaceful, homey. Style: pixel art reminiscent of 16-bit SNES action RPGs, but modern: soft dynamic lighting with visible light falloff, cast shadows and particles like in Children of Morta, coziness like Stardew Valley. Three-quarter top-down view (classic action RPG perspective, looking down at an angle). Uniform pixel density across the whole scene, crisp sharp pixels, no blur, no smoothing. No text, no letters, no signs with writing, no UI, no HUD. 16:9 widescreen.

**wuestenruine-nacht.jpg**
> Video game environment scene: a cozy home built inside ancient sandstone desert ruins at night. Crumbling sandstone walls and broken columns with carved patterns form a partially roofed shelter, with a canvas awning stretched between pillars. Inside and in the courtyard: layered colorful woven rugs and carpets in red, ochre and indigo, cushions, a low wooden table with a teapot, clay pots and baskets, a sleeping mat, hanging brass oil lamps and small oil lamps on ledges glowing warm orange. In the center of the courtyard a crackling campfire with rising sparks and embers, casting a warm flickering circle of light and long soft shadows across the sand and walls. A date palm and some desert shrubs, sand dunes beyond the ruins. Time: clear night, deep blue sky full of stars and a faint milky way, cool blue moonlight on the dunes contrasting with the warm firelight. Cozy, safe, magical. Style: pixel art reminiscent of 16-bit SNES action RPGs, but modern: soft dynamic lighting with visible light falloff, cast shadows and particles like in Children of Morta, coziness like Stardew Valley. Three-quarter top-down view (classic action RPG perspective, looking down at an angle). Uniform pixel density across the whole scene, crisp sharp pixels, no blur, no smoothing. No text, no letters, no UI, no HUD. 16:9 widescreen.

### Addendum: prompt for `waldhuette-abend.jpg` (iteration 1, generated by the planning session)

```
Pixel art scene inspired by 16-bit SNES action RPGs, with modern lighting like Children of Morta and the coziness of Stardew Valley. Three-quarter top-down view of a small cozy cottage at dusk at the edge of a forest meadow: warm orange light glowing from the windows and a lantern by the door casting soft light pools on the grass, chimney smoke, a vegetable garden with a wooden fence, flowers, a small stream with a wooden bridge. Consistent pixel density, crisp pixels, no blur, rich but harmonious warm palette with cool blue evening shadows. No text, no UI.
```
