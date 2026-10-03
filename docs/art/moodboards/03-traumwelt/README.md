# Moodboard 3 – Dream World

The dream world begins where the player's cozy world ends: the ground breaks off, chunks of earth drift away, and beyond lies an empty, floating expanse in deep indigo and violet. Narrow glowing paths lead through the nothing and connect floating fragments – an archway, a lone tree, a piece of bridge, a lantern. In the distance, other players' worlds hang as small islands with their own palettes, connected by delicate threads of light. The mood is calm, weightless, slightly melancholic; at the outermost rim, a portal hints at the shadow world.

Moodboards are append-only: every iteration is kept and shows how the direction evolved.

## Iteration 2 (2026-10-03, axis-aligned top-down view)

Feedback from maw: no 45° isometry, but an axis-aligned top-down view like *Stardew Valley*, *Secret of Mana*, *Zelda: A Link to the Past* (orthographic, looking from the "south", edges horizontal/vertical, no diagonal grid). Paths are now tile paths with right-angle turns, islands are rectangular.

| Image | Description |
|---|---|
| `it2-rand-der-welt.jpg` | A meadow with a cottage, fence and lantern ends at a straight edge; square chunks of earth drift into the violet, golden stepping stones lead out. |
| `it2-pfade-im-nichts.jpg` | One-tile-wide, cyan glowing paths with right-angle turns connect an archway, tree, bridge and lantern; character with a lantern. |
| `it2-ferne-welten.jpg` | From the grassy edge with a lantern you see four island worlds (snow village, harbor, oasis, jungle with waterfall), connected by threads of light. |
| `it2-rand-portal.jpg` | Rectangular stone platform with remains of pillars, a violet-red portal in the middle, a cottage's door, window and roof drifting around it. |

Note: in `it2-rand-der-welt.jpg` the stepping-stone path runs diagonally in steps (but aligned to the tile axes); the earth edge is seen more from the top, without a visible break-off face.

## Iteration 1 (2026-10-03, 45° isometric)

| Image | Description |
|---|---|
| `rand-der-welt.jpg` | Isometric meadow island with a stone cottage and lantern, crumbling at the edge; golden stepping stones lead into the violet void. |
| `pfade-im-nichts.jpg` | Curved, crossing light paths in indigo, fragments (archway, tree, bridge, lantern), character with a lantern. |
| `ferne-welten.jpg` | Floating island worlds connected by threads of light, a grassy edge with a lantern in the foreground. |
| `rand-portal.jpg` | Floating ruin with a swirling violet-red portal, twisted cottage parts drifting past. |

Note: `ferne-welten.jpg` contains a screen frame and a caption «Chaos in Hades» (the reference from the prompt was rendered as text). Not used as a style guide; replaced in iteration 2.

## Color mood

Computed with k-means over all images of the board (Python, without Pillow; images downscaled with `sips`).

| Hex | Role |
|---|---|
| `#070427` | deepest void indigo |
| `#190D35` | dream void, violet-black |
| `#3D4376` | mist, distant layers |
| `#340832` | rim toward the shadow world (purple) |
| `#797457` | stone, earth of the fragments |
| `#AFD6CD` | glowing paths (cyan-white) |
| `#E8B84A` | golden stepping stones, lantern light (estimated) |

## References

- Chaos in *Hades* (empty, floating expanse, fragments)
- *Stardew Valley*, *Secret of Mana*, *Zelda: A Link to the Past* (camera from iteration 2)
- *Children of Morta* (light, particles)
- Dark World in *Zelda: A Link to the Past* (portal at the rim)

## Prompts

### Iteration 2

**it2-rand-der-welt.jpg**
```
Pixel art in the style of a 16-bit SNES action RPG but modern: soft dynamic lighting, glow, drifting particles, cozy like Stardew Valley and Children of Morta; uniform pixel density, crisp sharp pixels, no text, no letters. CAMERA: axis-aligned orthographic top-down view exactly like Stardew Valley, Secret of Mana and Zelda: A Link to the Past — camera looks from the south, all edges are perfectly horizontal and vertical, square tile grid aligned to the screen, front faces of walls visible, roofs seen from above. NOT isometric, NO 45-degree diagonal grid. Scene: the southern/right edge of a cozy player world — grassy meadow tiles with a small cottage with warm glowing windows, a wooden fence, flowers and a lantern post — the tile grid simply ends and the ground breaks off into a straight cliff edge, beyond which lies an endless, empty, dark-violet dream void. Square chunks of earth float away. From the edge a narrow glowing golden path of square stepping stones leads straight out into the nothing. Far away, tiny floating islands of other worlds with faint lights. Calm, weightless, slightly melancholic; reference Chaos in Hades.
```

**it2-pfade-im-nichts.jpg**
```
Pixel art, 16-bit SNES action RPG inspired but modern: soft dynamic light, glowing particles, deep shadows; uniform pixel density, crisp sharp pixels, no text. CAMERA: axis-aligned orthographic top-down view like Stardew Valley, Secret of Mana and Zelda: A Link to the Past — viewed from the south, all edges horizontal and vertical, screen-aligned square tile grid; NOT isometric, NO diagonal grid. Scene: the dream world — a vast empty void of deep indigo and violet with faint star-like motes. Narrow luminous paths of pale cyan light, one tile wide, run in straight horizontal and vertical segments with right-angle turns through the nothing, connecting small floating fragments: a broken stone arch, a lone bare tree on a rock, a piece of wooden bridge, a lamppost still glowing. A small hooded player character walks along a path holding a lantern that lights the tiles around them. Empty, weightless, mysterious; reference Chaos in Hades.
```

**it2-ferne-welten.jpg**
```
Pixel art, 16-bit SNES RPG inspired but modern: soft dynamic light, atmospheric haze, glowing particles; uniform pixel density, crisp sharp pixels. Absolutely no text, no caption, no frame, no UI. CAMERA: axis-aligned orthographic top-down view like Stardew Valley, Secret of Mana and Zelda: A Link to the Past — seen from the south, all edges horizontal and vertical, screen-aligned tile grid; NOT isometric, NO diagonal grid. Scene: from the bottom edge of the frame, the straight cliff edge of a cozy grassy world with a lantern post; beyond it an endless dark dream void, in which several distant floating rectangular island-worlds hang at different sizes, each a different player's world with its own palette: a snowy village with warm windows, a desert oasis at dusk, a lush jungle with a waterfall pouring off its edge into the void, a small seaside fishing town. Thin glowing threads of light connect some of the islands. Calm, vast, lonely but hopeful; reference Chaos in Hades.
```

**it2-rand-portal.jpg**
```
Pixel art, 16-bit SNES action RPG inspired but modern: soft dynamic light, particles, shadows; uniform pixel density, crisp sharp pixels, no text. CAMERA: axis-aligned orthographic top-down view like Stardew Valley, Secret of Mana and Zelda: A Link to the Past — viewed from the south, all edges horizontal and vertical, screen-aligned square tile grid; NOT isometric, NO diagonal grid. Scene: the far rim of the dream world where the empty void grows uneasy: a narrow glowing path ends at a rectangular floating platform of old stone floor tiles with ruined pillars; in its center a swirling portal of dark purple and crimson light flickers, its glow tinting the tiles; drifting fragments of a familiar cottage (a door, a window, a piece of roof) float nearby, subtly twisted. Mostly calm and empty, a quiet hint of threat. Reference Chaos in Hades, Dark World in Zelda: A Link to the Past.
```

### Iteration 1

**rand-der-welt.jpg**
```
Pixel art in the style of a 16-bit SNES action RPG but modern: soft dynamic lighting, glow, drifting particles, cozy like Stardew Valley and Children of Morta; uniform pixel density, crisp sharp pixels, no text. Classic top-down three-quarter perspective. Scene: the edge of a cozy player world — a grassy meadow with a small cottage with warm glowing windows, a fence, flowers and a lantern — that crumbles at its edge into floating chunks of earth drifting away into an endless, empty, dark-violet dream void. From the edge, a narrow glowing golden path of floating stepping stones leads out into the nothing. Far away in the void, other small worlds float like distant islands, each with its own faint light. Calm, weightless, slightly melancholic atmosphere, reference: Chaos realm in Hades.
```

**pfade-im-nichts.jpg**
```
Pixel art, 16-bit SNES action RPG inspired but modern: soft dynamic light, glowing particles, deep shadows; uniform pixel density, crisp sharp pixels, no text. Top-down three-quarter perspective. Scene: the dream world — a vast empty void of deep indigo and violet with faint star-like motes. Narrow luminous paths of pale cyan light wind through the nothing, branching and connecting small floating fragments: a broken stone arch, a lone tree on a rock, a piece of a wooden bridge, a lamppost still glowing. A tiny player character walks along one path, carrying a small lantern that lights the path around them. Empty, weightless, mysterious, reference: Chaos in Hades.
```

**ferne-welten.jpg**
```
Pixel art, 16-bit SNES RPG inspired but modern: soft dynamic light, atmospheric haze, glowing particles; uniform pixel density, crisp sharp pixels, no text. Wide view: in an endless dark dream void, several distant floating island-worlds hang at different depths, each a different player's world with its own palette: a snowy village with warm lights, a desert oasis at dusk, a lush jungle with a waterfall pouring into the void, a small seaside fishing town. Thin glowing threads of light connect some of the islands like fragile paths. In the foreground, the crumbling grassy edge of a cozy world with a lantern on a post. Calm, vast, lonely but hopeful, reference: Chaos in Hades.
```

**rand-portal.jpg**
```
Pixel art, 16-bit SNES action RPG inspired but modern: soft dynamic light, particles, shadows; uniform pixel density, crisp sharp pixels, no text. Top-down three-quarter perspective. Scene: the far rim of the dream world, where the empty floating void becomes uneasy: narrow glowing paths end at a cluster of floating ruins, and on one fragment a faint swirling portal of dark purple and crimson light flickers, its glow distorting the space around it; drifting shards of a familiar cottage float nearby, subtly twisted. Mostly calm and empty, with a quiet hint of threat. Reference: Chaos in Hades, Dark World in Zelda A Link to the Past.
```
