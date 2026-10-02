# Moodboard 6 – UI & HUD

Die UI ist **nicht** standardmässig Pixel-UI (ADR 0010). Hauptrichtung von maw ist die Formensprache von Büchern: schlicht und elegant, mit verschnörkeltem Einband-Rahmen, Goldfiligran, Eckbeschlägen, Pergament- und Ledertönen und klassischer Serifen-Buchtypografie. Sie liegt hochaufgelöst und scharf über einer Pixel-Art-Spielszene und tritt dahinter zurück: das HUD als dezenter Rahmen mit HP und «Inspiration», das Inventar als aufgeschlagenes Buch, der Wunsch-Dialog als einzelne Buchseite mit Federkiel. Zum Vergleich gibt es eine Alternative in moderner, ruhiger, minimalistischer Gestaltung (Frosted Glass, Sans-Serif, ein Akzent).

Moodboards sind append-only: Jede Iteration bleibt erhalten und zeigt die Entwicklung.

## Iteration 1 (2026-10-03, achsenparallele Draufsicht im Hintergrund)

Die Spielszenen im Hintergrund wurden bereits mit maws Perspektiv-Vorgabe erzeugt (achsenparallele Draufsicht wie *Stardew Valley*, *Zelda: A Link to the Past*).

**Hauptrichtung: Buch-Formensprache**

| Bild | Beschreibung |
|---|---|
| `buch-hud.jpg` | Feiner goldener Einbandrahmen mit Leder-Eckbeschlägen um die Gartenszene; oben links HP-Balken und Tintenfass-Anzeige «Inspiration» in Serifenschrift, unten rechts ein Buch-Symbol als Menü. |
| `inventar-buchseite.jpg` | Inventar als aufgeschlagenes Buch mit Lesezeichenband, Item-Raster in gravierten Rahmen links, Detailillustration rechts – erster Versuch (mit Blindtext). |
| `inventar-buchseite-v2.jpg` | Zweiter Versuch: gleiches Prinzip, reich ornamentierte rechte Seite, Platzhalterlinien statt Text, rotes Seidenband. |
| `wunsch-dialog.jpg` | Wunsch-Dialog als einzelne Pergamentseite mit Goldranken, leerer Schreibzeile und Federkiel, darunter ein ornamentierter «Inspiration»-Balken; HP als Herzemblem oben rechts. |

**Alternative: modern-minimalistisch**

| Bild | Beschreibung |
|---|---|
| `alternative-minimal.jpg` | Erster Versuch – vom Generator als Gegenüberstellung mit Überschriften «Alternative Direction / Original Direction» gerendert (rechts Pixel-UI); nicht als Vorgabe verwenden. |
| `alternative-minimal-v2.jpg` | Zweiter Versuch: ein Frosted-Glass-Panel oben links mit HP- und Inspiration-Balken in Sans-Serif, drei runde Outline-Icons unten rechts. |

Auffälligkeiten:
- `inventar-buchseite.jpg` enthält Lorem-ipsum-Blindtext (Vorgabe: nur kurze Labels) → `-v2` erzeugt. In `-v2` sind die Platzhalterzeilen als Kritzel gerendert.
- `alternative-minimal.jpg` ist ein Split-Vergleich mit Überschriften statt einer Einzelszene → `-v2` erzeugt.
- In `buch-hud.jpg` und `inventar-buchseite-v2.jpg` sind Rahmen und Icons teils leicht «pixelig» geraten; die Typografie ist aber durchgehend serifenbetont und hochaufgelöst.
- Die Bilder sind JPEG (`.jpg`); das Tool hatte sie als `.png` benannt, am 2026-10-03 umbenannt.

## Farbstimmung

Per k-Means über die Bilder der Hauptrichtung berechnet (Python, ohne Pillow; Bilder via `sips` verkleinert); Gold geschätzt.

| Hex | Rolle |
|---|---|
| `#D6C29C` | Pergament |
| `#8F6F4C` | Leder, gealtertes Papier |
| `#52392B` | dunkles Leder, Holz |
| `#C9A44C` | Goldfiligran, Rahmenlinien (geschätzt) |
| `#B3262B` | HP-Rot, Seidenband (geschätzt) |
| `#223937` | Spielszene Nachtgrün |
| `#211F21` | Abdunklung hinter Menüs |

Alternative (minimal): `#20252C` (Glas-Panel), `#E8A85A` (Bernstein-Akzent, geschätzt), `#8E9BF0` (Inspiration-Blau, geschätzt), `#3E483E` (Szene).

## Referenzen

- Klassische Buchkunst: Prachteinbände, Goldprägung, Filigran, Exlibris, Lesezeichenbänder
- Buchtypografie mit Serifen (z. B. Garamond-/Caslon-artig)
- Spielszenen: *Stardew Valley*, *Zelda: A Link to the Past*
- Alternative: zeitgenössische minimalistische Spiel-HUDs (Frosted Glass, eine Akzentfarbe)

## Prompts

**buch-hud.jpg**
```
Game UI mockup screenshot, 16:9. Background: a pixel-art game scene in 16-bit SNES action RPG style with modern soft lighting — a cozy cottage garden at dusk, CAMERA axis-aligned orthographic top-down like Stardew Valley and Zelda: A Link to the Past (not isometric), a small player character in the middle. Overlaid UI is NOT pixel art: it is crisp, high-resolution, elegant and minimal, inspired by the design language of old books: thin ornate gilded filigree frame lines, small embossed corner ornaments like a book cover, parchment and dark leather tones, refined serif typography. Top-left: a slim ornamented HP bar labeled "HP" in a classic serif font. Below it a delicate golden ink-well style gauge labeled "Inspiration", softly glowing. Bottom-right: a small closed ornate book icon as a menu button. UI is subtle, small and stays out of the way; the world remains the star. No other text.
```

**inventar-buchseite.jpg**
```
Game UI mockup screenshot, 16:9. Background: a pixel-art game scene (16-bit SNES action RPG style, modern lighting, axis-aligned orthographic top-down camera like Stardew Valley, not isometric) of a cozy cottage interior, dimmed and slightly blurred behind the menu. In front: an inventory screen designed as an open antique book — two parchment pages inside a dark leather cover with gilded, embossed ornamental border and corner fittings, a silk ribbon bookmark. Left page: an elegant grid of item slots drawn as thin engraved ink frames with small pixel-art item icons inside (potion, key, lantern, apple, feather quill). Right page: a larger illustration of the selected item and a few lines of elegant serif typography as placeholder. Headline at top of the left page in a classic book serif: "Inventory". UI rendered in crisp high resolution, not pixel font; calm, refined, readable. No other readable text besides "Inventory".
```

**inventar-buchseite-v2.jpg**
```
Game UI mockup screenshot, 16:9. Background: a pixel-art game scene (16-bit SNES action RPG style, modern warm lighting, axis-aligned orthographic top-down camera like Stardew Valley, not isometric) of a cozy cottage interior, dimmed behind the menu. In front: an inventory screen designed as an open antique book — two parchment pages inside a dark leather cover with gilded embossed ornamental border and corner fittings, a silk ribbon bookmark. Left page: a grid of item slots drawn as thin engraved ink frames with small pixel-art item icons (potion, key, lantern, apple, feather quill). Right page: a larger illustration of the selected lantern above a decorative ornamental flourish divider and a few faint wavy grey placeholder lines (no actual words). Headline at the top of the left page in a classic book serif: "Inventory". UI crisp high resolution, not pixel font; calm and refined. The ONLY text in the whole image is the single word "Inventory" — no lorem ipsum, no paragraphs, no other words.
```

**wunsch-dialog.jpg**
```
Game UI mockup screenshot, 16:9. Background: a pixel-art night scene in 16-bit SNES action RPG style with modern soft lighting, a forest clearing with a glowing stone pedestal, axis-aligned orthographic top-down camera like Zelda: A Link to the Past (not isometric). Overlaid at the bottom center: a wish-writing dialog styled as a single page torn from an ornate book — cream parchment with an elegant gilded vine filigree border, a small embossed emblem at the top, an empty handwriting line with a feather quill cursor, and below a slim ornamented progress bar labeled "Inspiration" in a refined serif font, half filled with soft golden light. Top-right: a minimal ornamented heart-shaped emblem with "HP". UI is crisp high resolution, elegant book typography, not pixel art, not cluttered. Only the labels "Inspiration" and "HP" as text.
```

**alternative-minimal.jpg**
```
Game UI mockup screenshot, 16:9, alternative direction for comparison. Background: a pixel-art game scene in 16-bit SNES action RPG style with modern soft lighting, a cozy cottage garden at dusk, axis-aligned orthographic top-down camera like Stardew Valley (not isometric), small player character. Overlaid UI: modern, calm, minimalist — thin clean lines, translucent dark frosted-glass panels with rounded corners, generous spacing, a single soft accent color (warm amber), clean modern sans-serif typography, no ornaments. Top-left: slim HP bar labeled "HP" and a thin glowing bar labeled "Inspiration". Bottom-right: three small circular icon buttons. Very subtle, the world remains the star. Crisp high resolution UI, not pixel art. Only the labels "HP" and "Inspiration" as text.
```

**alternative-minimal-v2.jpg**
```
A single full-screen game screenshot (not a comparison, not split, no headings, no captions). Pixel-art game scene in 16-bit SNES action RPG style with modern soft lighting: a cozy cottage garden at dusk with lanterns, axis-aligned orthographic top-down camera like Stardew Valley (not isometric), a small player character in the center. Overlaid HUD in a modern, calm, minimalist style: one small translucent dark frosted-glass panel with rounded corners in the top-left containing a slim warm-amber HP bar labeled "HP" and a thin softly glowing bar labeled "Inspiration" in a clean modern sans-serif; three small circular outline icon buttons in the bottom-right (bag, map, gear). No ornaments, thin lines, generous spacing, crisp high-resolution UI, not pixel art. The only text in the image: "HP" and "Inspiration".
```
