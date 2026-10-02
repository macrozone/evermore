# R1.1 – Statische orthografische Testwelt

Route: `/lab/r1-voxel`, Bead: `evermore-1fo.3.1`.

![Ganze meadow-house-Testwelt](screenshots/r1-voxel-static.png)

Aufnahme: Chromium (headless), 1440 × 1080 Viewport, 02.10.2026.
Kamera: Neigung 38° über dem Horizont, Drehung 25° (0° = Blick aus Süden), Zoom 1×.
Welt: `meadow-house`, Seed `20261002`, 10 Chunk-Meshes, 51 020 Dreiecke.

Beim Vergleichen auf die Lesbarkeit von Haus, Brücke, Hügelkanten und Turm achten; die Grundansicht zeigt die ganze Welt und behält bei anderer Drehung/Neigung einen Rand. Die Dachstufen und Bäume sind bewusst reine Voxel mit Materialfarben und einfacher Beleuchtung. Für Detailansichten zoomen und die aktuellen Werte über «Settings JSON» kopieren; «Fit whole world» setzt nur Zoom auf 1× zurück.

Offene gestalterische Fragen für maw: Wirkt 38° ausreichend wie ein 2D-RPG oder sollte die Neigung flacher sein? Ist die leichte Drehung von 25° hilfreich oder passt ein gerader Südblick besser?

Diese Scheibe enthält keinen Spieler, keine Cutaways und keinen Pixel-Renderpass; Wasser, Glas und Laub sind deckende Platzhalter. Rendering erfolgt nur bei Initialisierung, Kameraänderung und Resize, daher gibt es hier noch keine Game-Loop-FPS-Messung.

Prüfung: Typecheck, Lint, vollständige Tests und Produktions-Build. Die sechs neuen Geometrie-/Kameratests prüfen äussere Flächenorientierung, Nähte über alle Chunk-Achsen, leere Randchunks und vollständige Kameraframing-Grenzen für Hoch-/Querformat und verschiedene Winkel.
