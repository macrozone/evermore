# Moodboard 5 – The Entity

The entity is the hidden AI of the shadow world, the players' shadow. It is never shown in full, only implied: a silhouette of darkness larger than the house below it; eyes watching patiently from the forest; strange lines writing themselves into the Book of Evermore; a rift in the familiar world through which an eye looks. It feels intelligent and intimidating, not brutal – it wants to challenge, not destroy. Precisely the cozy places (home, candlelight, village square) are where it appears; the warm/cold contrast (amber against violet and cold teal) carries the threat.

Moodboards are append-only: every iteration is kept and shows how the direction evolved.

## Iteration 1 (2026-10-03, axis-aligned top-down view)

Already generated with maw's perspective guideline (axis-aligned top-down view like *Stardew Valley*, *Secret of Mana*, *Zelda: A Link to the Past*). `augen-im-dunkel.jpg` and `fremde-zeilen-im-buch.jpg` are deliberately front/object views (mood images, not game scenes).

| Image | Description |
|---|---|
| `silhouette-ueber-dem-haus.jpg` | Shadow-world version of the home (crooked cottage, dead meadow, cold teal lantern), behind it a huge shadow figure with two pale eyes. |
| `augen-im-dunkel.jpg` | Almost black forest with mist, many pairs of pale eyes between the trunks and a large violet glowing pair in the middle. |
| `fremde-zeilen-im-buch.jpg` | In the cozy room with candles and fireplace, violet, vein-like alien glyphs write themselves into the book, the candle flame burns cold blue. |
| `riss-in-der-welt.jpg` | Warm village square in top-down view, a rift like torn paper running through the middle, behind it the purple shadow-world version with an eye. |

Notes:
- In `fremde-zeilen-im-buch.jpg` some alien glyphs resemble Latin letters (pseudo-readable); still usable for the "alien script" direction.
- In `silhouette-ueber-dem-haus.jpg` the cottage roof is drawn slightly slanted; the grid is axis-aligned though.
- The images are JPEG (`.jpg`); the tool had named them `.png`, renamed on 2026-10-03.

## Color mood

Computed with k-means over all images of the board (Python, without Pillow; images downscaled with `sips`); accents estimated.

| Hex | Role |
|---|---|
| `#01010B` | absolute darkness |
| `#090917` | shadow forest, night |
| `#1C1224` | shadow figure, violet black |
| `#382F39` | faded shadow-world surfaces |
| `#6F3B2D` | warm wood of the normal world |
| `#B17D59` | candle/lantern light on wood and stone |
| `#9B6BFF` | eyes, alien ink (accent, estimated) |
| `#4FD1C5` | cold lantern light of the shadow world (accent, estimated) |

## References

- Dark World in *Zelda: A Link to the Past*
- Upside Down in *Stranger Things*
- Vision 3.4/3.5: the entity as a hidden AI antagonist that seeks contact (for example through the book)

## Prompts

**silhouette-ueber-dem-haus.jpg**
```
Pixel art, 16-bit SNES action RPG inspired but modern: dynamic lighting, deep shadows, drifting dark particles; uniform pixel density, crisp sharp pixels, no text. CAMERA: axis-aligned orthographic top-down view like Stardew Valley, Secret of Mana and Zelda: A Link to the Past — viewed from the south, all edges horizontal and vertical, screen-aligned square tile grid; NOT isometric, NO diagonal grid. Scene: the shadow world, a distorted copy of a cozy home: a crooked cottage with dark windows, a twisted fence, dead grey-violet grass, a lantern burning with cold teal light. Behind the house, filling the upper half of the frame, a gigantic shapeless silhouette made of shadow looms over everything, only implied — no clear body, just darkness slightly darker than the night, with two faint pale eyes. A tiny player character stands near the lantern. Intimidating, ominous, quiet. References: Dark World in Zelda A Link to the Past, Upside Down in Stranger Things.
```

**augen-im-dunkel.jpg**
```
Pixel art, 16-bit SNES RPG inspired but modern: dynamic lighting, deep shadows, subtle particles; uniform pixel density, crisp sharp pixels, no text. Scene: almost total darkness in a dense shadow-world forest at night, viewed from the front. Among black tree trunks, many pairs of eyes glow faintly at different distances — some pale white, one large pair in the center glowing a cold violet, calmly watching. A thin mist reflects a little of their light. Nothing else is shown; the presence is only implied. Unsettling, patient, intelligent, intimidating rather than gory.
```

**fremde-zeilen-im-buch.jpg**
```
Pixel art, 16-bit SNES RPG inspired but modern, slightly painterly lighting; uniform pixel density, crisp sharp pixels. No readable words or letters. Scene: the ornate Book of Evermore lies open on a wooden lectern by candlelight. On the parchment page, lines of strange writing are appearing by themselves — illegible, alien glyph-like scribbles in dark violet ink that bleed and creep across the page like veins, written by no visible hand. The candle flame bends unnaturally and burns cold blue; a thin wisp of shadow rises from the page. The cozy room around it is warm, the page is the only thing wrong. Ominous, quiet contact from a hidden intelligence.
```

**riss-in-der-welt.jpg**
```
Pixel art, 16-bit SNES action RPG inspired but modern: soft dynamic lighting, shadows, particles, cozy like Stardew Valley; uniform pixel density, crisp sharp pixels, no text. CAMERA: axis-aligned orthographic top-down view like Stardew Valley, Secret of Mana and Zelda: A Link to the Past — viewed from the south, all edges horizontal and vertical, screen-aligned square tile grid; NOT isometric, NO diagonal grid. Scene: a cozy village square at dusk with warm lantern light, flowerbeds and a small well. Straight through the middle of the tiles runs a jagged vertical rift in reality, like torn paper: inside it, the twisted shadow-world version of the same village is visible in desaturated violet and crimson, with a hint of a huge dark eye looking through the crack. Shadowy particles leak out, the warm light around the rift is drained of color. Reference: Upside Down in Stranger Things, Dark World in Zelda.
```
