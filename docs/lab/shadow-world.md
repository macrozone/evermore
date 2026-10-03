# Schattenwelt-Experiment

Bead: `evermore-1fo.13`, Seite: `/lab/r1-voxel`.

Normal/Schatten umschalten und die vier G1-Beispiele mit der festen Meadow-House-Welt vergleichen. Die Schattenvariante behält Zellbelegung, Kollisionen, Spawn und benannte Strukturen. Violette Materialien und seedabhängige dunkle Verfallsflecken verändern den Eindruck, ohne Räume oder Wege neu zu generieren.

Die Gefahren-Heatmap mischt Blau (wenig Einfluss) bis Rot (Maximum) in die sichtbaren Flächen. Das erste Bett in z/y/x-Reihenfolge ist das Zentrum, sonst der Spawn. Der Einfluss fällt horizontal linear ab und erreicht bei einer halben Weltdiagonale null. Dadurch ist die Gefahr auch auf dem Dach über dem Bett sichtbar. Die Werte sind eine Experimentannahme, keine festgelegte Spielbalance.

## Visuelle Prüfung

- [Normal](screenshots/r1-shadow-normal.png)
- [Schatten](screenshots/r1-shadow.png)
- [Schatten mit Gefahren-Heatmap](screenshots/r1-shadow-danger.png)

Auf die identische Haus-/Brücken-/Baum-Anordnung und das rote Maximum am Zuhause achten. Die Kamera-, Licht- und Pixel-Regler bleiben mit dem Ergebnis sichtbar; das kopierbare JSON enthält Weltwahl, Schattenmodus und Heatmap. Lokale Meadow-House-Leuchten werden in der Schattenvariante und in G1-Welten deaktiviert, weil deren Positionen nur für die feste normale Testwelt definiert sind.

Automatisch geprüft: deterministische Ableitung, unveränderte Quelldaten, gleiche Kollisions-/Transparenzeigenschaften, Strukturkopien, Serialisierung, Einflussmaximum und Radiusvalidierung sowie Debugfarben im Chunk-Mesh. Headless-Browser: Umschaltung, Heatmap und alle vier G1-Beispiele ohne Browserfehler.

Offen für spätere Experimente: Formverzerrung, mehrere Einflusszentren und die konkrete Darstellung von Gefahren. Wasser, Glas und Laub bleiben die bestehenden deckenden R1-Platzhalter.
