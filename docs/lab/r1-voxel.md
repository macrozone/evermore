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

## R1.5 – Lichtquellen und Tag/Nacht

Bead: `evermore-1fo.3.5`. Aufnahme: Chromium mit Software-WebGL,
1440 × 1400 (Canvas 1104 × 621) und 390 × 844, 03.10.2026.

![Tag um 12:00](screenshots/r1-light-day.png)

![Nacht um 00:00](screenshots/r1-light-night.png)

[Mobile Nachtansicht mit Reglern und JSON](screenshots/r1-light-night-mobile.png).

Der Regler läuft über 24 Stunden: Sonnenaufgang um 06:00, Sonnenuntergang um
18:00, abends wärmeres Sonnenlicht, nachts kühles Mondlicht und Sterne. Sonne
und Mond wandern auf gegenüberliegenden Bahnen; die Schattenrichtung und
-länge folgen den Richtungslichtern. Die Himmelskörper sind stilisierte,
bildschirmbezogene Pixel-Scheiben im Hintergrundpass, keine astronomische
Simulation. Der Himmel und seine Sterne verwenden dasselbe Pixelraster wie
die Welt.

Die Fixture-Begleitdaten liefern fünf lokale Quellen: Innenkamin, zwei
Laternen, Fensterlicht und eine neue Gartenfeuerstelle. PointLights mit
Distanzabfall und 512² Würfelschattenkarten erhellen die Umgebung; emissive
Voxel-Flächen machen Laternen, Fenster und Feuer selbst sichtbar. Das
Fensterlicht sitzt ausserhalb der Südwand, damit die unverändert deckenden
Glas-Voxel es nicht vollständig abschatten. Das Feuer im Garten zeigt den
dritten Quellentyp bereits in der Aussenansicht; der Innenkamin bleibt bis
zur Gebäude-Cutaway-Scheibe hinter dem Dach.

Alle Parameter sind gemeinsam mit Kamera und Pixel-Look als JSON kopierbar:
Tageszeit, Radius-Multiplikator, lokale Intensität, Farbtemperatur in Kelvin,
Mondlicht, Schatten/Weichheit und Zeitraffer-Geschwindigkeit. Lokales Licht
bleibt tagsüber eingeschaltet, wird aber auf 20 % reduziert. Zeitraffer ist
optional, standardmässig pausiert, auf zwölf Updates pro Sekunde begrenzt und
pausiert in versteckten Tabs. Sonst bleibt das Rendering ereignisgetrieben;
Unmount gibt auch lokale Materialien, Geometrien und Schattenkarten frei.

Worauf achten: Bei Nacht bilden Fenster, Laternen und Feuer eine warme Insel
gegen die kühle Umgebung; «Local lights» an/aus zeigt den tatsächlichen
Lichtkegel und die Schattenwirkung. Zwischen Morgen und Abend wechseln
Richtung und Länge der Baumschatten. Radius, Intensität, Temperatur und
Schattenweichheit verändern, wie weit und wie weich diese Insel wirkt.
Die Art-Bible-Prüfung sieht konsistente Pixeldichte, sichtbare lokale Quellen
und eine wärmere Zuhause-Stimmung; die gesamte Testwelt bleibt ein Diorama.

Offene Fragen für maw: Ist die Nacht hell genug zum Spielen, oder sollen
Mond/Umgebung heller werden? Ist der warme Lichtbereich ums Haus gross genug?
Passt der stilisierte Sternenhimmel um das Diorama, oder später lieber nur
ein abstrakter Hintergrund?

Browserprüfung: Regler für Radius, Intensität, Temperatur, Mondlicht und
Schattenweichheit sowie Licht/Schatten an/aus ändern nachweislich das
Canvas-Bild. JSON und echter Clipboard-Export, Zeitraffer/Pause und mobile
Ansicht ohne horizontalen Überlauf geprüft. Keine Shader-/JavaScript-Fehler;
die bestehende fehlende `/favicon.ico` liefert 404, Software-WebGL meldet beim
Screenshot gelegentlich ReadPixels-Stalls. ADE-Proof konnte wegen fehlender
Desktop-Bridge und nicht erlaubtem Worktree-Importpfad nicht registriert
werden; die Bilder sind deshalb als Repo-Artefakte versioniert.

Qualitätsprüfungen: Typecheck, Lint, vollständige Tests (50 www, 40 world,
5 core, 6 ESLint) und Produktions-Build ohne Turbo-Cache grün. Lokale
Node-Version 23.6.0 statt Projektziel 22; auch der vorhandene Pfad
`/opt/homebrew/opt/node@22/bin/node` meldet 23.6.0. Die finalen Screenshots und
Browserprüfungen stammen vom Produktions-Build.

## R1.3 – Spieler, Bewegung und Treppen

Bead: `evermore-1fo.3.3`. Die Startansicht ist der achsenparallele «2D look»
(45°, Rotation 0°), mit Zoom 2,2× und einer Kamera, die dem Spieler folgt.
Ins Weltbild klicken und WASD/Pfeiltasten verwenden; Tab oder ein Klick ins
Panel gibt die Tastatur frei und stoppt die Bewegung. «Reset player» setzt
Figur und Nachführung vor die Haustür zurück.

![Spieler vor der Haustür, Bewegung und Follow-Regler](screenshots/r1-player.png)

[Spieler im Obergeschoss (Floor 6)](screenshots/r1-player-upstairs.png),
[Mobilansicht](screenshots/r1-player-mobile.png),
[Zoom 0,5×](screenshots/r1-player-zoom-min.png) und
[Zoom 8×](screenshots/r1-player-zoom-max.png).

Das framework-freie Movement aus `packages/core` simuliert mit 60 Hz:
Subpixel-Positionen, normalisierte Diagonalen, Beschleunigung/Abbremsung,
Wandgleiten und Corner Correction. Der Voxel-Adapter prüft alle vom
Fuss-Rechteck berührten Zellen (Radius 0,22), begehbare Unterstützung innerhalb
von ±1 Höhenzelle und zwei Zellen gemeinsame Kopffreiheit. Die Fixture öffnet
deshalb die Decke auch über der Anlaufzelle vor der Küchentreppe. Wasser,
Wände, Möbel und Weltgrenzen bleiben Hindernisse; Dächer werden nicht als
Boden unter dem Spieler gewählt. Regler für Geschwindigkeit, Beschleunigung,
Abbremsung, Ecktoleranz und Kamera-Follow sind gemeinsam im kopierbaren JSON.

Der gemeinsame vierteilige Platzhalter wird als Nearest-gefiltertes Billboard
gezeichnet; nur seine Bildschirmposition wird auf Renderpixel gerundet.
Die Simulation bleibt präzise. Die Nachführung verwendet zeitunabhängige
exponentielle Dämpfung. Die Figur bleibt als Navigationsmarker vor der
Geometrie sichtbar: Im Haus liegt das Dach weiterhin darüber und die Figur
wirkt im Bild deshalb, als stünde sie darauf. Echte Cutaways und natürliche
Okklusion gehören zur folgenden Scheibe R1.4.

Das unabhängig scrollbare Panel steht neben dem Canvas und bleibt auch bei
390 Pixel Viewportbreite gleichzeitig sichtbar. Kamera-Presets erhalten den
gewählten Zoom. Der Bildschirm-Pass benutzt eine separate Kamera und wird
nicht nach Weltkoordinaten aussortiert; sonst verschwand er beim Follow/Zoom.
Bewegung, Lichtflackern und Zeitraffer teilen eine auf Unmount beendete Loop;
versteckte Tabs pausieren. Unveränderte Schattenkarten werden beim Laufen
wiederverwendet, idle Flackern bleibt auf 30 Render-Updates/s begrenzt.

Worauf achten: Erst durch die Haustür nach Norden, durch die Innentür im
Wohnzimmer nach Osten und in der Küche an der Nordwand die Treppe von Westen
nach Osten nehmen – «Floor» wechselt von 3 auf 6 und auf dem Rückweg wieder
zurück. Draussen führen der Weg, die Brücke und die Hügelstufen durch die Welt;
Wasser und die zweizelligen Klippen blockieren. Speed und Follow im Panel
ändern und die direkte Bewegung mit träger bzw. enger Nachführung vergleichen.

Art-Bible-Eindruck: Achsenparallele Perspektive, gemeinsames Pixelraster und
warme lokale Beleuchtung bleiben erhalten; der helle Platzhalter ist deutlich
lesbar. Die sichtbare Figur auf dem geschlossenen Dach ist bewusst noch keine
fertige Innenraumdarstellung. Offene Fragen für maw: Passen Tempo 4 Zellen/s,
Follow 10/s und Zoom 2,2×? Soll die Kamera künftig einen kleinen Vorlauf in
Blickrichtung bekommen?

Automatisierte Browserprüfung bei laufendem lokalen www-Server:
`node scripts/check-r1-player.mjs http://127.0.0.1:<BASE_PORT>`.
Sie prüft einen nicht leeren Renderpass, echte Tastaturbewegung durch die
Haustüren und Treppe in beide Richtungen, Fokusverlust, JSON/Clipboard,
Panel-Scroll ohne Überschneidung, Zoom-Grenzen, Zeitraffer, Idle-Flackern,
Mobilansicht ohne horizontalen Überlauf und JavaScript-/Shaderfehler.
Fünf Modelltests decken Fuss-AABB, Wasser/Wände/Grenzen, Wandgleiten, den
Hausweg, Brücke/Hügel, Kopffreiheit, kamerabezogene Eingabe und zeitunabhängige
Dämpfung ab. Screenshots headless aufgenommen und selbst angesehen.
Software-WebGL-FPS sind kein Nachweis für 60 fps auf Spieler-Hardware.

Abschlussprüfungen: `pnpm install`, Typecheck, Lint, vollständige Tests
(98 www, 55 world, 13 core plus bestehende ESLint-/Script-Tests) und
Produktions-Build grün. Lokale Node-Version 23.6.0 statt Projektziel 22;
die vorhandene Engine-Warnung hat die Checks nicht verhindert.

## R1 – Depth of field

Bead: `evermore-1fo.3.11`. Enable **Depth of field** to try a miniature
scene: the sharp depth band follows the player's actual camera depth,
including while the camera catches up or the player changes floor.
**Blur strength** ranges from 0–6 low-resolution pixels; **Focus range**
is the half-width of the sharp band, in world cells. Defaults are off,
3 pixels and ±6 cells. All three values are included in Settings JSON.

The screen shader reads an orthographic depth texture and samples the world
in whole render-pixel steps before nearest-neighbour upscaling. It keeps
focused pixels untouched. The player billboard writes its own depth while
preserving its current navigation-overlay behavior, so the player remains
sharp even when the roof behind it is out of focus. Transparent sprite
pixels do not overwrite terrain depth. A gradual, quantized blur radius
outside the sharp band avoids smoothing the final screen-pixel grid.
The sky remains sharp; edge coverage is unpremultiplied before compositing
to avoid dark fringes. No additional scene render pass is required.

![Depth of field, wide view](screenshots/r1-depth-of-field/moderate.png)

Compare [off](screenshots/r1-depth-of-field/off.png) with
[maximum blur and narrow focus](screenshots/r1-depth-of-field/on.png).
The exaggerated setting makes the depth bands clear but sacrifices terrain
readability; start with the defaults and reduce blur for navigation.
Top-down separates heights rather than north/south positions; this is
camera depth rather than a fixed screen-space tilt-shift mask.

Run `node scripts/check-r1-depth-of-field.mjs http://127.0.0.1:<BASE_PORT>`
against a local www server. The headless check compares framebuffer pixels
for off/zero strength, visible blur, unchanged player torso and a consistent
nearest-upscaled grid. It also exercises moving focus with slow camera
follow, every camera preset at both zoom limits, JSON/clipboard, panel scroll,
390px mobile layout and time-lapse. Unit tests compare player focus against
the actual orthographic depth-buffer mapping across presets, movement,
elevation and zoom.

## R1.8 – Spezifikation und Seed generieren

Bead: `evermore-1fo.3.8`. Im Panel **Generate world** eine G1-Beispielwelt
oder die aus dem Buch übergebene Spezifikation wählen. Quelle und Seed bleiben
ein Entwurf, bis **Generate** beide gemeinsam übernimmt. **Roll seed** würfelt
nur den Entwurf; erneutes Generieren setzt die Figur an den Spawn zurück, auch
bei unveränderten Eingaben. Meadow house bleibt eine feste Vergleichs-Fixture
mit deaktiviertem Seed-Feld. Der bestehende Hash-/localStorage-Handoff wird
weiterverwendet; explizite Links haben Vorrang, ungültige Links zeigen Fehler.

![Quell-Spezifikation neben ihrer Voxel-Welt](screenshots/r1-generation/source.png)

[Ergebnis mit aktivem Seed und Spieler](screenshots/r1-generation/result.png),
[Mobilansicht](screenshots/r1-generation/mobile.png).
Aufnahme: Produktions-Build, Chromium headless, 1440 × 1000 bzw. 390 × 844,
04.10.2026. Forest village, Seed `r1-review`, Wide view/Zoom 1×,
2D-Look 45°/0°. Gemessen: 6,0 ms reine G1-Generierung, ohne Meshing und GPU-Aufbau.
Die Seite bleibt in der Lab-Registry; ihre Beschreibung nennt nun die Generierung.

Worauf achten: Fluss, Wald und Gebäude aus dem Source JSON mit dem Ergebnis
vergleichen; erst ein anderer Seed plus Generate verändert die Welt. Ins Canvas
klicken und laufen, dann mit demselben Seed neu generieren: Welt und Spawn sind
reproduzierbar. Canvas und scrollbares Panel bleiben auch mobil nebeneinander.
Der 16-Bit-Eindruck profitiert vom gemeinsamen Pixelraster und warmen Licht;
G1-Bäume und Gebäude bleiben grobe Voxel-Platzhalter. Die Kamera folgt weiterhin
dem Spieler, deshalb ist Wide view keine garantiert vollständige Weltübersicht.

Offene gestalterische Fragen für maw: Sind die G1-Gebäude/Waldabstände in dieser
Ansicht gut lesbar? Soll die Importquelle künftig direkt hier editierbar sein
oder bleiben Buch/G1 die Bearbeitungsorte? Keine neue Architekturentscheidung.

Prüfung: `node scripts/check-r1-generation.mjs http://127.0.0.1:<port>` prüft
Entwurf/Übernahme, identische Framebuffer bei gleichem Seed, andere Terrainbilder
bei anderem Seed, Bewegung/Spawn-Reset, Hash-Vorrang, Storage-Import, Fixture,
ungültige Links, mobile Überläufe und Laufzeitfehler. Setup, Typecheck, Lint,
Produktions-Build und vollständige Tests grün (294 www, 81 world, 13 core,
6 ESLint plus Script-Tests; ein Live-Test ausgelassen). Der erste Testlauf traf
den bereits erfassten parallelen Seed-Request-Flake `evermore-k0f0y`; der zweite
vollständige Lauf bestand. Lokale Node-Version 23.6.0 statt Projektziel 22.
