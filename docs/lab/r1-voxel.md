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

## R1.2 – Pixel-Look und Licht

Bead: `evermore-1fo.3.2`. Aufnahme: Chromium (headless, Software-WebGL),
1440 × 1200 und 390 × 844 Viewport, 03.10.2026.

![Pixel-Look mit warmem Sonnenlicht](screenshots/r1-voxel-pixel.png)

[Mobile Ansicht mit Reglern und JSON](screenshots/r1-voxel-pixel-mobile.png).

Die Welt rendert ohne Antialiasing in ein niedrig aufgelöstes Render-Target;
ein zweiter Pass skaliert mit Nearest-Filter und stellt Sättigung sowie optionale
tonale Farbreduktion ein. Die Auflösung folgt dem Viewport mit einem ganzzahligen
Skalierungsfaktor: maximal 720 Pixel Breite, mindestens 2 CSS-Pixel pro Renderpixel
als Startwerte (Desktop-Aufnahme: 552 × 310). Das bewahrt mehr Dach- und
Baumdetails als ein festes 480 × 270 Target, passend zu maws Feedback.
Alle Look- und Kamera-Werte sind zusammen als JSON kopierbar.

Warmes gerichtetes Sonnenlicht und kühles Umgebungslicht erzeugen die
Grundstimmung. Alle Chunk-Meshes werfen und empfangen Schatten; PCF-Filter,
2048² Schattenkarte und ein Weichheitsregler sorgen für weichere Kanten.
Render-Target, Bildschirmgeometrie, Material und Schattenkarte werden beim
Unmount freigegeben. Rendering bleibt ereignisgetrieben.

Worauf achten: Hausdach, Brücke und Baumkronen bleiben trotz Pixelraster lesbar;
die Schatten geben den Bäumen und dem Haus eine erkennbare Richtung und Tiefe.
Mit «Minimum pixel size» und «Maximum render width» feine und grobe Ansichten
vergleichen; die tonale Palette ist bewusst optional und standardmässig aus.
Die Art-Bible-Prüfung sieht konsistente Pixeldichte und wärmeres Licht; für ein
wirklich lebendiges, gemütliches Zuhause fehlen noch die angekündigten Details
der neuen Testwelt und lokale Lichtquellen.

Offene Fragen für maw: Ist die Start-Pixeldichte fein genug oder soll 1 CSS-Pixel
der Standard sein? Passt die warme Sonnenrichtung, und soll die optionale
Farbreduktion später durch eine bewusst gestaltete Biom-Palette ersetzt werden?

Validierung: Frozen install, Typecheck, Lint, vollständige Tests (40 www,
38 world, 5 core, 6 ESLint) und Produktions-Build grün. Browserprüfung:
keine Console-/Shaderfehler; Pixelgrösse, Palette, Schatten an/aus, Reset und
JSON-Export geprüft; Desktop und Mobil visuell geprüft. Node lokal 24.18 statt
Projektziel 22. ADE-Proof-Anhang scheitert an der lokalen CLI-Verbindung
(`sources.agentChatService.subscribeToEvents is not a function)); Screenshots
sind deshalb versioniert im Repo.
