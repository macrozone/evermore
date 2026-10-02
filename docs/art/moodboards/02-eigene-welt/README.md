# Moodboard 2 – Eigene Welt

Die eigene Welt ist das Zuhause des Spielers: warm, vertraut und lebendig, je nach Beschreibung des Spielers als Waldhütte, Fischerhaus oder Lager in einer Wüstenruine. Licht erzählt die Stimmung – Fensterlicht, Laternen, Lagerfeuer und Öllampen werfen sichtbare warme Lichtinseln in kühlere Umgebung. Der Look ist Pixel-Art mit SNES-Anmutung, aber modern umgesetzt: weiches dynamisches Licht, gerichtete Schatten, Partikel (Glühwürmchen, Funken, Pollen). Gemütlichkeit wie in *Stardew Valley*, Licht- und Partikelarbeit wie in *Children of Morta*. Dieselben Orte erscheinen in [Board 4 – Schattenwelt](../04-schattenwelt/README.md) als verzerrte Spiegelung.

Moodboards sind append-only: Jede Iteration bleibt erhalten und zeigt die Entwicklung.

## Iteration 2 (2026-10-03, achsenparallele Draufsicht)

Feedback maw: keine 45°-Isometrie, sondern achsenparallele Draufsicht wie *Stardew Valley*, *Secret of Mana*, *Zelda: A Link to the Past* (orthografisch, Blick von «Süden», Kanten horizontal/vertikal, Dächer und Fassaden sichtbar).

| Bild | Beschreibung |
|---|---|
| `it2-waldhuette-abend.jpg` | Waldhütte mit Strohdach am Abend, warme Fenster- und Laternenlichtkegel auf Weg und Wiese, Bach mit Brücke, Gemüsegarten, Glühwürmchen. |
| `it2-waldhuette-tag.jpg` | Dieselbe Szene am sonnigen Vormittag mit kurzen Schatten, Lichtflecken unter den Bäumen, Schmetterlingen und Glitzern auf dem Bach. |
| `it2-hafenstadt-abend.jpg` | Steinernes Fischerhaus am Kai, Steg mit Laternen und zwei Booten, Fischtrockengestell, Netze und Möwen im Abendblau. |
| `it2-wuestenruine-nacht.jpg` | Wohnlich eingerichtete Sandsteinruine mit Teppichen, Kissen, Teetisch, Öllampen und Lagerfeuer, umgeben von mondbeschienenen Dünen. |

Auffälligkeit: Bei `it2-wuestenruine-nacht.jpg` sind Dünen und Sternenhimmel am Rand eher seitlich gesehen, die Ruine selbst ist in Draufsicht – Perspektive nicht ganz konsistent.

## Iteration 1 (2026-10-03, 45° isometrisch)

| Bild | Beschreibung |
|---|---|
| `waldhuette-abend.jpg` | Waldhütte am Abend mit Garten, Bach, Brücke und Laterne, Mondsichel über dem Wald (vorbestehend, Prompt nicht dokumentiert). |
| `waldhuette-tag.jpg` | Dieselbe Waldhütte am sonnigen Vormittag mit Lichtstrahlen durch die Bäume und Blumenwiese. |
| `hafenstadt-abend.jpg` | Fischerhaus auf einem Holzsteg am Meer bei Dämmerung, Laternen, Boote, Möwen, warmes Fensterlicht. |
| `wuestenruine-nacht.jpg` | Zuhause in einer Wüstenruine bei Nacht mit Lagerfeuer, Teppichen, Öllampen und Sternenhimmel. |

## Farbstimmung

Dominante Farben per Median-Cut (Pillow) über alle Bilder des Boards berechnet; Lichtakzente aus den Bildern geschätzt.

| Hex | Rolle |
|---|---|
| `#234B55` | Nachtgrün/Petrol (Schatten, Wasser, Abendwiese) |
| `#120E29` | tiefes Nachtindigo (Himmel, Meer) |
| `#18478F` | Bachblau |
| `#6CA652` | sattes Wiesengrün (Tag) |
| `#87513F` | Holz, Fachwerk, Steg |
| `#CC7442` | Terrakotta, Ziegel, Kürbis |
| `#B0B158` | Strohdach, Sand |
| `#F2A43A` | warmes Lampen-/Feuerlicht (geschätzt) |

## Referenzen

- *Stardew Valley* – Gemütlichkeit, Zuhause, Garten; achsenparallele Draufsicht
- *Secret of Mana*, *Zelda: A Link to the Past* – SNES-Draufsicht, Fassaden und Dächer sichtbar
- *Children of Morta* – dynamisches Licht, Schatten, Partikel auf Pixel-Art
- Art Bible: [`docs/art/README.md`](../../README.md), Vision Abschnitt 5

## Prompts

Erzeugt mit `create_asset` (media-pipeline, Modell `gemini-3-pro-image-preview`), Seitenverhältnis 16:9. Die Bilder sind JPEG (`.jpg`); das Tool hatte sie als `.png` benannt, am 2026-10-03 umbenannt.

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

**waldhuette-abend.jpg** – vorbestehend, Prompt nicht dokumentiert.

**waldhuette-tag.jpg**
> Video game environment scene: a small thatched-roof timber-framed forest cottage with stone base and chimney, wooden door with a hanging lantern, rain barrel at the side, a fenced vegetable garden with pumpkins, cabbages and carrots to the right, wildflowers in the grass, a winding blue stream in the foreground crossed by a small wooden plank bridge, a dirt path from the door to the bridge, surrounded by deciduous trees and pine forest. Time: sunny late morning, bright warm sunlight from the upper left, crisp short shadows cast by trees, house and fence, dappled light through the leaves, sparkling highlights on the stream, butterflies and floating pollen particles, a thin wisp of chimney smoke, clear blue sky with a few soft clouds. Fresh greens, warm golden light, cheerful and cozy. Style: pixel art reminiscent of 16-bit SNES action RPGs, but modern: soft dynamic lighting, cast shadows and particles like in Children of Morta, coziness like Stardew Valley. Three-quarter top-down view (classic action RPG perspective, looking down at an angle). Uniform pixel density across the whole scene, crisp sharp pixels, no blur, no smoothing. No text, no letters, no UI, no HUD. 16:9 widescreen.

**hafenstadt-abend.jpg**
> Video game environment scene: a small cozy fisherman's house with a slanted tiled roof and a crooked chimney in a little harbor town by the sea, standing at the edge of a wooden pier. Nets, crates, barrels, ropes and a fish-drying rack beside the house, a few potted plants by the door. Lanterns on posts along the wooden jetty cast warm pools of light on the planks and reflect in the dark water. Two or three small wooden fishing boats moored at the jetty, gently bobbing. Warm yellow-orange light glowing from the house windows, spilling onto the ground. Neighboring houses of the harbor town in the background with lit windows, a stone quay wall. Seagulls perched on posts and flying. Time: evening dusk, sky fading from orange-pink at the horizon to deep blue-violet, first stars, calm sea with shimmering light reflections, fireflies or floating ember particles near the lanterns. Cozy, peaceful, homey. Style: pixel art reminiscent of 16-bit SNES action RPGs, but modern: soft dynamic lighting with visible light falloff, cast shadows and particles like in Children of Morta, coziness like Stardew Valley. Three-quarter top-down view (classic action RPG perspective, looking down at an angle). Uniform pixel density across the whole scene, crisp sharp pixels, no blur, no smoothing. No text, no letters, no signs with writing, no UI, no HUD. 16:9 widescreen.

**wuestenruine-nacht.jpg**
> Video game environment scene: a cozy home built inside ancient sandstone desert ruins at night. Crumbling sandstone walls and broken columns with carved patterns form a partially roofed shelter, with a canvas awning stretched between pillars. Inside and in the courtyard: layered colorful woven rugs and carpets in red, ochre and indigo, cushions, a low wooden table with a teapot, clay pots and baskets, a sleeping mat, hanging brass oil lamps and small oil lamps on ledges glowing warm orange. In the center of the courtyard a crackling campfire with rising sparks and embers, casting a warm flickering circle of light and long soft shadows across the sand and walls. A date palm and some desert shrubs, sand dunes beyond the ruins. Time: clear night, deep blue sky full of stars and a faint milky way, cool blue moonlight on the dunes contrasting with the warm firelight. Cozy, safe, magical. Style: pixel art reminiscent of 16-bit SNES action RPGs, but modern: soft dynamic lighting with visible light falloff, cast shadows and particles like in Children of Morta, coziness like Stardew Valley. Three-quarter top-down view (classic action RPG perspective, looking down at an angle). Uniform pixel density across the whole scene, crisp sharp pixels, no blur, no smoothing. No text, no letters, no UI, no HUD. 16:9 widescreen.

### Nachtrag: Prompt für `waldhuette-abend.jpg` (Iteration 1, erzeugt von der Planungs-Session)

```
Pixel art scene inspired by 16-bit SNES action RPGs, with modern lighting like Children of Morta and the coziness of Stardew Valley. Three-quarter top-down view of a small cozy cottage at dusk at the edge of a forest meadow: warm orange light glowing from the windows and a lantern by the door casting soft light pools on the grass, chimney smoke, a vegetable garden with a wooden fence, flowers, a small stream with a wooden bridge. Consistent pixel density, crisp pixels, no blur, rich but harmonious warm palette with cool blue evening shadows. No text, no UI.
```
