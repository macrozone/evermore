# Moodboard 3 – Traumwelt

Die Traumwelt beginnt dort, wo die gemütliche Welt des Spielers aufhört: Der Boden bricht ab, Erdbrocken treiben davon, und dahinter liegt eine leere, schwebende Weite in tiefem Indigo und Violett. Schmale leuchtende Pfade führen durchs Nichts und verbinden schwebende Fragmente – einen Torbogen, einen einsamen Baum, ein Stück Brücke, eine Laterne. In der Ferne hängen die Welten anderer Spieler als kleine Inseln mit eigener Palette, verbunden durch zarte Lichtfäden. Die Stimmung ist ruhig, schwerelos, leicht melancholisch; am äussersten Rand kündigt sich mit einem Portal die Schattenwelt an.

Moodboards sind append-only: Jede Iteration bleibt erhalten und zeigt die Entwicklung.

## Iteration 2 (2026-10-03, achsenparallele Draufsicht)

Feedback maw: keine 45°-Isometrie, sondern achsenparallele Draufsicht wie *Stardew Valley*, *Secret of Mana*, *Zelda: A Link to the Past* (orthografisch, Blick von «Süden», Kanten horizontal/vertikal, kein Diagonal-Raster). Pfade sind jetzt Kachel-Pfade mit rechtwinkligen Abzweigungen, Inseln rechteckig.

| Bild | Beschreibung |
|---|---|
| `it2-rand-der-welt.jpg` | Wiese mit Hütte, Zaun und Laterne endet an einer geraden Kante; quadratische Erdbrocken treiben ins Violett, goldene Trittsteine führen hinaus. |
| `it2-pfade-im-nichts.jpg` | Kachelbreite, cyan leuchtende Pfade mit rechtwinkligen Kurven verbinden Torbogen, Baum, Brücke und Laterne; Figur mit Laterne. |
| `it2-ferne-welten.jpg` | Vom Grasrand mit Laterne aus sieht man vier Inselwelten (Schneedorf, Hafen, Oase, Dschungel mit Wasserfall), verbunden durch Lichtfäden. |
| `it2-rand-portal.jpg` | Rechteckige Steinplattform mit Säulenresten, in der Mitte ein violett-rotes Portal, ringsum treiben Tür, Fenster und Dach einer Hütte. |

Auffälligkeit: In `it2-rand-der-welt.jpg` verläuft der Trittstein-Pfad treppenförmig diagonal (aber kachelachsenparallel); die Erdkante ist eher Draufsicht ohne sichtbare Abbruchfläche.

## Iteration 1 (2026-10-03, 45° isometrisch)

| Bild | Beschreibung |
|---|---|
| `rand-der-welt.jpg` | Isometrische Wiesen-Insel mit Steinhütte und Laterne, die an der Kante zerbröckelt; goldene Trittsteine führen in die violette Leere. |
| `pfade-im-nichts.jpg` | Geschwungene, kreuzende Lichtpfade im Indigo, Fragmente (Torbogen, Baum, Brücke, Laterne), Figur mit Laterne. |
| `ferne-welten.jpg` | Schwebende Inselwelten verbunden durch Lichtfäden, vorne ein Grasrand mit Laterne. |
| `rand-portal.jpg` | Schwebende Ruine mit wirbelndem violett-rotem Portal, verdrehte Hüttenteile treiben vorbei. |

Auffälligkeit: `ferne-welten.jpg` enthält einen Bildschirmrahmen und eine Beschriftung «Chaos in Hades» (Referenz aus dem Prompt wurde als Text gerendert). Wird nicht als Stilvorgabe verwendet; in Iteration 2 ersetzt.

## Farbstimmung

Per k-Means über alle Bilder des Boards berechnet (Python, ohne Pillow; Bilder via `sips` verkleinert).

| Hex | Rolle |
|---|---|
| `#070427` | tiefstes Leere-Indigo |
| `#190D35` | Traumleere, Violett-Schwarz |
| `#3D4376` | Nebel, ferne Schichten |
| `#340832` | Rand zur Schattenwelt (Purpur) |
| `#797457` | Stein, Erde der Fragmente |
| `#AFD6CD` | leuchtende Pfade (Cyan-Weiss) |
| `#E8B84A` | goldene Trittsteine, Laternenlicht (geschätzt) |

## Referenzen

- Chaos in *Hades* (leere, schwebende Weite, Fragmente)
- *Stardew Valley*, *Secret of Mana*, *Zelda: A Link to the Past* (Kamera ab Iteration 2)
- *Children of Morta* (Licht, Partikel)
- Dark World in *Zelda: A Link to the Past* (Portal am Rand)

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
