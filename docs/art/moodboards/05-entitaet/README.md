# Moodboard 5 – Die Entität

Die Entität ist die verborgene KI der Schattenwelt, der Schatten der Spieler. Sie wird nie ganz gezeigt, sondern nur angedeutet: eine Silhouette aus Dunkelheit, die grösser ist als das Haus darunter; Augen, die geduldig aus dem Wald schauen; fremde Zeilen, die sich von selbst ins Book of Evermore schreiben; ein Riss in der vertrauten Welt, durch den ein Auge blickt. Sie wirkt intelligent und einschüchternd, nicht brutal – sie will herausfordern, nicht vernichten. Gerade das Gemütliche (Zuhause, Kerzenlicht, Dorfplatz) wird zum Ort ihres Auftauchens; der Kontrast warm/kalt (Bernstein gegen Violett und kaltes Türkis) trägt die Bedrohung.

Moodboards sind append-only: Jede Iteration bleibt erhalten und zeigt die Entwicklung.

## Iteration 1 (2026-10-03, achsenparallele Draufsicht)

Bereits mit maws Perspektiv-Vorgabe erzeugt (achsenparallele Draufsicht wie *Stardew Valley*, *Secret of Mana*, *Zelda: A Link to the Past*). `augen-im-dunkel.jpg` und `fremde-zeilen-im-buch.jpg` sind bewusst Frontal-/Objektansichten (Stimmungsbilder, keine Spielszene).

| Bild | Beschreibung |
|---|---|
| `silhouette-ueber-dem-haus.jpg` | Schattenwelt-Version des Zuhauses (schiefe Hütte, tote Wiese, kalt-türkise Laterne), dahinter eine riesige Schattengestalt mit zwei fahlen Augen. |
| `augen-im-dunkel.jpg` | Fast schwarzer Wald mit Nebel, zwischen den Stämmen viele fahle Augenpaare und in der Mitte ein grosses violett leuchtendes. |
| `fremde-zeilen-im-buch.jpg` | Im gemütlichen Kerzen- und Kaminzimmer schreiben sich violette, aderartige Fremdzeichen ins Buch, die Kerzenflamme brennt kalt blau. |
| `riss-in-der-welt.jpg` | Warmer Dorfplatz in Draufsicht, mitten hindurch ein Riss wie zerrissenes Papier, dahinter die purpurne Schattenwelt-Version mit einem Auge. |

Auffälligkeiten:
- In `fremde-zeilen-im-buch.jpg` ähneln einzelne Fremdzeichen lateinischen Buchstaben (pseudo-lesbar); für die Richtung «fremde Schrift» trotzdem brauchbar.
- In `silhouette-ueber-dem-haus.jpg` ist das Hüttendach leicht schräg gezeichnet; das Raster ist aber achsenparallel.
- Die Bilder sind JPEG (`.jpg`); das Tool hatte sie als `.png` benannt, am 2026-10-03 umbenannt.

## Farbstimmung

Per k-Means über alle Bilder des Boards berechnet (Python, ohne Pillow; Bilder via `sips` verkleinert); Akzente geschätzt.

| Hex | Rolle |
|---|---|
| `#01010B` | absolutes Dunkel |
| `#090917` | Schattenwald, Nacht |
| `#1C1224` | Schattengestalt, violettes Schwarz |
| `#382F39` | verblichene Schattenwelt-Oberflächen |
| `#6F3B2D` | warmes Holz der normalen Welt |
| `#B17D59` | Kerzen-/Laternenlicht auf Holz und Stein |
| `#9B6BFF` | Augen, fremde Tinte (Akzent, geschätzt) |
| `#4FD1C5` | kaltes Laternenlicht der Schattenwelt (Akzent, geschätzt) |

## Referenzen

- Dark World in *Zelda: A Link to the Past*
- Upside Down in *Stranger Things*
- Vision 3.4/3.5: Entität als verborgener KI-Antagonist, der Kontakt sucht (etwa über das Buch)

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
