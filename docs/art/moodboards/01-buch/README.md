# Moodboard 1 – Book of Evermore

Das Book of Evermore ist der Anfang und das Werkzeug jedes Spielers: ein altes, elegantes Buch mit verschnörkeltem Einband, Goldprägung, Metallbeschlägen und einem Juwelen-Emblem. Es liegt im warmen Kerzenlicht auf einem geschnitzten Pult, umgeben von Regalen im Halbdunkel – geborgen, ruhig, ein wenig geheimnisvoll. Aufgeschlagen zeigt es leere Zeilen und einen Federkiel: Es wartet darauf, dass man hineinschreibt. Die Variante «Worte werden Welt» zeigt das Leitmotiv direkt: Aus den Seiten wächst eine kleine Pixel-Landschaft. Die Bilder dürfen malerischer sein als Spielszenen, bleiben aber im Pixel-Look.

Moodboards sind append-only: Jede Iteration bleibt erhalten und zeigt die Entwicklung.

## Iteration 1 (2026-10-03, Objekt-/Frontalansicht)

Das Buch als Objekt, nicht als Spielszene – daher frontal bzw. leicht von oben. `buch-auf-lichtung.jpg` ist bereits in achsenparalleler Draufsicht (passt zum Feedback von maw zur Welt-Perspektive). Eine Iteration 2 mit `it2-`-Präfix war für dieses Board nicht nötig.

| Bild | Beschreibung |
|---|---|
| `einband-pult-kerzenlicht.jpg` | Geschlossenes Buch mit Goldfiligran, Eckbeschlägen und Juwelen-Emblem auf einem Pult zwischen zwei Kerzen, Bücherregale im Dunkel. |
| `offene-seite-federkiel.jpg` | Aufgeschlagenes Buch mit leeren, linierten Pergamentseiten und Ornament-Ecken, Federkiel im Tintenfass, Kerzen und Kamin im Hintergrund. |
| `worte-werden-welt.jpg` | Aus den aufgeschlagenen Seiten wächst eine Pixel-Landschaft mit Hütte, Weg, Bäumen und einem Bach, der als Wasserfall über den Seitenrand fällt. |
| `buch-auf-lichtung.jpg` | Das leuchtende Buch auf einem Steinsockel in einer nächtlichen Waldlichtung, davor eine kleine Spielfigur – Draufsicht wie im Spiel. |

Auffälligkeiten:
- `einband-pult-kerzenlicht.jpg` wurde im ersten Versuch mit dem Schriftzug «BOOK OF EVERMORE» auf dem Einband erzeugt (Vorgabe: kein Text) und vor Einführung der Append-only-Regel durch den zweiten Versuch (ohne Titel, Draufsicht aufs Pult) überschrieben. Der erste Versuch ist nicht mehr vorhanden.
- Die Bilder sind JPEG (`.jpg`); das Tool hatte sie als `.png` benannt, am 2026-10-03 umbenannt.

## Farbstimmung

Per k-Means über alle Bilder des Boards berechnet (Python, ohne Pillow; Bilder via `sips` verkleinert).

| Hex | Rolle |
|---|---|
| `#11090F` | fast schwarzes Raumdunkel |
| `#351B14` | dunkles Holz, Schatten |
| `#673A1E` | Pult- und Einbandleder |
| `#9A7646` | Gold im Halbschatten, Pergament im Schatten |
| `#D7AA71` | Kerzenlicht auf Pergament |
| `#0E2245` | Nachtblau (Lichtung) |
| `#4A535F` | kühles Grau (Stein, Federkiel) |

## Referenzen

- *Stardew Valley* (Gemütlichkeit, warme Innenräume)
- *Children of Morta* (weiches Licht, Partikel)
- 16-Bit-SNES-Action-RPGs (*Zelda: A Link to the Past*, *Secret of Mana*)
- Klassische Buchkunst: Goldprägung, Filigran, Eckbeschläge, Prachteinbände

## Prompts

**einband-pult-kerzenlicht.jpg** (zweiter Versuch, aktuell)
```
Pixel art in the style of a 16-bit SNES RPG but modern: soft dynamic lighting, shadows, floating dust particles, cozy atmosphere like Stardew Valley and Children of Morta; uniform pixel density, crisp sharp pixels. IMPORTANT: no text, no letters, no title, no writing anywhere in the image. Scene: an ancient, elegant leather-bound tome lying closed on a carved wooden lectern in a quiet study. The cover has no title, only purely decorative ornament: embossed gold filigree, swirling flourishes, vines, corner metal fittings and a central ornate jeweled emblem. Warm candlelight from two candles beside it casts glowing light pools and long soft shadows; dark wood shelves fade into shadow behind. Slightly painterly lighting, but clearly pixel art.
```
(Erster Versuch, überschrieben: gleicher Prompt ohne den «IMPORTANT: no text …»-Satz, Buch als «the "Book of Evermore"» benannt – daraus entstand der Titel-Schriftzug.)

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
