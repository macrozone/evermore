# Moodboard 1 – Book of Evermore

The Book of Evermore is every player's starting point and tool: an old, elegant book with an ornate cover, gold embossing, metal fittings and a jeweled emblem. It lies in warm candlelight on a carved lectern, surrounded by shelves in half-darkness – sheltered, calm, a little mysterious. Opened, it shows blank lines and a quill: it is waiting for someone to write in it. The «Worte werden Welt» ("words become world") variant shows the central motif directly: a small pixel landscape grows out of the pages. The images may be more painterly than game scenes, but stay in the pixel look.

Moodboards are append-only: every iteration is kept and shows how the direction evolved.

## Iteration 1 (2026-10-03, object/front view)

The book as an object, not as a game scene – hence front view or slightly from above. `buch-auf-lichtung.jpg` already uses the axis-aligned top-down view (matching maw's feedback on the world perspective). An iteration 2 with the `it2-` prefix was not needed for this board.

| Image | Description |
|---|---|
| `einband-pult-kerzenlicht.jpg` | Closed book with gold filigree, corner fittings and a jeweled emblem on a lectern between two candles, bookshelves in the dark. |
| `offene-seite-federkiel.jpg` | Open book with blank, ruled parchment pages and ornamental corners, quill in an inkwell, candles and fireplace in the background. |
| `worte-werden-welt.jpg` | A pixel landscape with a cottage, path, trees and a stream grows out of the open pages; the stream falls over the page edge as a waterfall. |
| `buch-auf-lichtung.jpg` | The glowing book on a stone pedestal in a forest clearing at night, a small player character in front of it – top-down view as in the game. |

Notes:
- The first attempt at `einband-pult-kerzenlicht.jpg` had the lettering «BOOK OF EVERMORE» on the cover (brief: no text). Before the append-only rule was introduced, it was overwritten by the second attempt (no title, top-down view of the lectern). The first attempt no longer exists.
- The images are JPEG (`.jpg`); the tool had named them `.png`, renamed on 2026-10-03.

## Color mood

Computed with k-means over all images of the board (Python, without Pillow; images downscaled with `sips`).

| Hex | Role |
|---|---|
| `#11090F` | near-black room darkness |
| `#351B14` | dark wood, shadows |
| `#673A1E` | lectern and cover leather |
| `#9A7646` | gold in half-shadow, parchment in shadow |
| `#D7AA71` | candlelight on parchment |
| `#0E2245` | night blue (clearing) |
| `#4A535F` | cool gray (stone, quill) |

## References

- *Stardew Valley* (coziness, warm interiors)
- *Children of Morta* (soft light, particles)
- 16-bit SNES action RPGs (*Zelda: A Link to the Past*, *Secret of Mana*)
- Classic bookbinding: gold embossing, filigree, corner fittings, ornate bindings

## Prompts

**einband-pult-kerzenlicht.jpg** (second attempt, current)
```
Pixel art in the style of a 16-bit SNES RPG but modern: soft dynamic lighting, shadows, floating dust particles, cozy atmosphere like Stardew Valley and Children of Morta; uniform pixel density, crisp sharp pixels. IMPORTANT: no text, no letters, no title, no writing anywhere in the image. Scene: an ancient, elegant leather-bound tome lying closed on a carved wooden lectern in a quiet study. The cover has no title, only purely decorative ornament: embossed gold filigree, swirling flourishes, vines, corner metal fittings and a central ornate jeweled emblem. Warm candlelight from two candles beside it casts glowing light pools and long soft shadows; dark wood shelves fade into shadow behind. Slightly painterly lighting, but clearly pixel art.
```
(First attempt, overwritten: same prompt without the «IMPORTANT: no text …» sentence, with the book named «the "Book of Evermore"» – which produced the title lettering.)

**offene-seite-federkiel.jpg**
```
Pixel art in the style of a 16-bit SNES RPG but modern: soft dynamic lighting, shadows, floating particles, cozy atmosphere like Stardew Valley; uniform pixel density, crisp sharp pixels, absolutely no readable text or letters. Scene: close view from slightly above of an old ornate book lying open on a wooden lectern. The parchment pages are blank except for faint empty ruled lines and decorative ornamental borders; a feather quill rests in an inkwell beside it, a single drop of ink glinting. Warm candlelight from the left, gentle glow on the pages, dark cozy room in the background. The book invites the viewer to write.
```

**worte-werden-welt.jpg**
```
Pixel art, 16-bit SNES RPG inspired but modern, slightly painterly and magical: soft dynamic light, glowing particles, cozy warm palette; uniform pixel density, crisp sharp pixels, no text, no letters. Scene: "words become world" — an ancient ornate open book on a candle-lit lectern, and out of its pages a tiny pixel-art landscape grows upward like a pop-up diorama: rolling green hills, a little cottage with a glowing window and smoke from the chimney, a winding path, small trees, a stream falling over the page edge like a waterfall. Golden sparkles rise from the paper where the land is forming. Dark cozy study background.
```

**buch-auf-lichtung.jpg**
```
Pixel art, 16-bit SNES action RPG inspired but modern: soft dynamic lighting, shadows, particles, cozy like Stardew Valley; uniform pixel density, crisp sharp pixels, no text. Scene: the ornate Book of Evermore opened on a stone pedestal in a small moonlit forest clearing at night, the pages glowing softly from within, warm light spilling onto the grass and the surrounding trees, fireflies drifting; a small player character silhouette stands before it, seen in classic top-down three-quarter action RPG perspective. Mysterious, inviting beginning of a journey.
```
