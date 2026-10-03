# Moodboard 7 – Player Characters

The player character is created from the answer to the book's question «Who are you?» (Vision 3.1) – as a pixel-art sprite with all facing directions and a walk animation. The four examples show how different these answers can be: a young cartographer with a lantern, an old fisherman, a desert nomad and a small forest spirit. What they share is the SNES sprite feel: a clear dark outline, few shading steps, an easily readable silhouette, a small ground shadow. Each character has a distinguishing feature (lantern, yellow oilskin coat, indigo scarf, leaf on the head) that keeps it recognizable even when small on screen.

Moodboards are append-only: every iteration is kept and shows how the direction evolved.

## Iteration 1 (2026-10-03, views for the axis-aligned top-down view)

Already generated with maw's perspective guideline: front, side and back views matching an axis-aligned camera from the "south" (like *Stardew Valley*, *Secret of Mana*, *Zelda: A Link to the Past*), no diagonal 3/4 views. One row per image: front, side (right), back, walking pose.

| Image | Description |
|---|---|
| `kartografin.jpg` | Young cartographer with auburn hair, green traveling coat, map tubes on her back, satchel and a glowing brass lantern. |
| `alter-fischer.jpg` | Old fisherman with a white beard, yellow sou'wester and oilskin coat, rubber boots, fishing rod over his shoulder and a wicker basket. |
| `wuestennomadin.jpg` | Desert nomad woman in indigo and sand tones with a face scarf, gold bangles, a shepherd's staff and a water gourd. |
| `waldgeist.jpg` | Round forest spirit made of moss and bark with a leaf on its head, green glowing eyes, little twig arms and floating spores. |

Notes:
- The nomad is slimmer and drawn at a higher resolution (finer proportions) than the stockier chibi characters cartographer and fisherman – pixel density is not fully consistent across the images. A fixed sprite size must be defined for the game.
- The fisherman does not hold the fishing rod consistently in the front and back views (the side switches).
- The images are JPEG (`.jpg`); the tool had named them `.png`, renamed on 2026-10-03.

## Color mood

Computed with k-means over all characters, gray background filtered out (Python, without Pillow; images downscaled with `sips`).

| Hex | Role |
|---|---|
| `#251F20` | outline, darkest shadows |
| `#3F3F46` | boots, trousers, shading |
| `#59382C` | leather, bags, wood |
| `#AB6422` | hair, lantern brass |
| `#E4BE4E` | oilskin yellow, lantern light, gold |
| `#696646` | moss, coat green in shadow |
| `#646076` | indigo fabrics |
| `#9C825E` | sand tones, bark |
| `#C6C5BD` | neutral background |

## References

- *Secret of Mana*, *Zelda: A Link to the Past* (sprite proportions, 4 facing directions)
- *Stardew Valley* (character readability, warm coloring)
- Vision 3.1: player character generated from «Who are you?»

## Prompts

All four prompts follow the same template; only the character description (and, for the forest spirit, size/pose) differs.

**Template**
```
Pixel art character sprite sheet in 16-bit SNES action RPG style (like Secret of Mana, Zelda: A Link to the Past, Stardew Valley), on a plain neutral light-grey background, no text, no labels. Character: <FIGUR>. Show the same character in a single horizontal row, evenly spaced and identical scale: 1) front view facing down/toward the camera, 2) side view facing right, 3) back view facing up/away, 4) walking pose (side view mid-stride). Views fit a top-down orthographic game camera seen from the south (axis-aligned, not isometric, no diagonal 3/4 angles). Chunky readable sprite about 32 pixels tall scaled up with crisp nearest-neighbor pixels, uniform pixel size, clean dark outline, soft shading, small drop shadow under each sprite.
```

**kartografin.jpg** – `<FIGUR>`:
```
a young cartographer girl with a rolled map tube on her back, short auburn hair, green traveling coat, satchel, holding a small glowing brass lantern
```

**alter-fischer.jpg** – `<FIGUR>`:
```
an old fisherman with a white beard, weathered yellow rain hat and oilskin coat, rubber boots, carrying a fishing rod over his shoulder and a small wicker basket
```

**wuestennomadin.jpg** – `<FIGUR>`:
```
a desert nomad woman wrapped in flowing indigo and sand-colored robes and a head scarf that covers her lower face, golden jewelry, a curved staff, a water gourd at her belt
```

**waldgeist.jpg** – `<FIGUR>` (additionally «4) walking/hopping pose (side view)» and «about 24 pixels tall»):
```
a small forest spirit — a round little creature made of moss and bark with a leaf sprouting from its head, big glowing pale-green eyes, tiny twig arms, a few floating glowing spores around it
```
