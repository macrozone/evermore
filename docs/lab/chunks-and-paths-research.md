# Recherche: prozedurale Wege und grosse Welten

Stand: 2026-10-03 · Bead: evermore-1fo.21 · Experiment, keine Architekturentscheidung.

## Empfehlung für das nächste Experiment

Ein semantischer Graph verbindet Zuhause, Dorfeingänge und Landmarken. Ein Kostenfeld auf dem Gelände realisiert seine Kanten als Wege. Zuerst Gelände und Gewässer, dann Gebäude-Footprints und Eingänge reservieren, dann Wege und Brücken, zuletzt Vegetation. Gegenüber den rechtwinkligen, auf eine Basishöhe eingeebneten Wegen von G1 erlaubt das Umwege und erhält die Landschaft. Verbindungen sollen nach der Objektplatzierung nochmals mit der tatsächlichen Spieler-Kollision geprüft werden.

| Verfahren | Stärken | Grenzen für Evermore | Empfohlene Rolle |
|---|---|---|---|
| A* / Kostenfelder | Verbindet konkrete Endpunkte; Kosten gewichten Gelände und Bauaufwand | Sucht nur im definierten Graphen; ein günstiger Weg ist nicht automatisch schön | Primärer Kandidat für Wege: Länge + Steigung + Wasser + Schutzgebiete; bestehende Wege günstig halten |
| L-Systeme / Grammatiken | Wiederverwendbare Wachstums- und Strukturregeln | Ein verzweigtes Netz allein garantiert keine Verbindung zu bestimmten Eingängen oder begehbare Höhen | Optionale Vorschläge für Dorfstrassen und Pflanzenformen, danach Geländeprüfung |
| Wave Function Collapse | Lokale Nachbarschaftsregeln für Tiles und Bauteile | Widersprüche möglich; lokale Konsistenz garantiert keine globale Erreichbarkeit | Kleine Dorfblöcke, Fassaden und Übergänge mit fixierten Randbedingungen |
| Poisson-Disk-Sampling | Mindestabstand verhindert Vegetationsklumpen | Platziert Punkte, plant keine Strassen; chunkweises Sampling braucht Randkoordination | Vegetation nach Wegreservierung; Abstand auch über Chunkgrenzen prüfen |

Die Rollen sind unsere Ableitung aus den Quellen, kein direktes Ergebnis eines Benchmarks aller vier Verfahren. A* kombiniert bisherige Kosten und eine Heuristik; unterschiedliche Geländekosten gehören in die Kanten. [Red Blob Games, Einführung in A*](https://www.redblobgames.com/pathfinding/a-star/introduction.html).

Grammatiken und L-Systeme werden für Vegetation und Levels behandelt. Die Einordnung als ergänzender Strukturgeber ist eine Empfehlung für unseren Eingangs-/Landmarkenfall. [Togelius, Shaker, Dormans: Kapitel 5](https://www.pcgbook.com/chapter05.pdf).

WFC propagiert lokale Muster-/Nachbarschaftsbedingungen und kann in einen Widerspruch geraten. [Gumins Referenzimplementierung](https://github.com/mxgmn/WaveFunctionCollapse).

Bridsons Verfahren erzeugt Punkte mit Mindestabstand über eine aktive Liste, Kandidaten im Ring und ein räumliches Raster; bei fester Kandidatenzahl ist der Aufwand linear in der Punktzahl. [Bridson, SIGGRAPH 2007](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph07-poissondisk.pdf).

## Höhen und Brücken

Landwege sollten die vorhandene Höhe halten, höchstens `MAX_STEP_HEIGHT` pro Nachbarzelle steigen und `PLAYER_HEIGHT` Kopffreiheit behalten. Grössere Höhenunterschiede benötigen explizit geplante Treppen oder Serpentinen. Wasser bekommt hohe Kosten; eine Brücke ist ein eigenes Bauvorhaben mit Uferanschlüssen, Deckhöhe, freier Durchfahrt und später einem `bridge`-Strukturvolumen. Feste Querungen können Makro-Graph-Kanten sein. Nicht jede Wasserzelle darf beliebig als Brücke bebaut werden: lange Spannweiten, Meer und geschützte Bereiche brauchen ein Ausschluss-/Budgetmodell.

## Chunks und deterministische Generierung

`World` nutzt schon 32×32×16-Zellen-Chunks. Zellen werden erst beim Schreiben alloziert, aber das Slot-Array hängt weiterhin von der gesamten begrenzten Weltgrösse ab. Das ist keine unendliche oder vollständig gestreamte Welt. Ein voller Chunk enthält 32 768 Bytes Zellmaterialien, ohne JS-Overhead. Der Prototyp erzeugt eine horizontale Chunkspalte explizit bei Bedarf; `getCell` bleibt frei von Generierungs-Nebenwirkungen.

Für grössere Welten empfehlen wir als nächsten Versuch:

1. Globale Koordinaten für Gelände-/Wassersamples; Seed, Generatorversion und Spezifikation als stabile Identität. RNG-Ströme für Objekte aus `seed + version + layer + cx/cy/cz` ableiten. Ein gemeinsamer fortlaufender RNG würde Lade-Reihenfolgen sichtbar machen.
2. Regionsgraph und Wegpolylinien oberhalb der Chunks planen und speichern. Jeder Chunk rasterisiert nur seinen Teil derselben Linie, statt Wege unabhängig neu zu suchen. Grenzportale und Deckhöhen gemeinsam festlegen.
3. Vegetationskandidaten im Chunk plus Halo berechnen, nur Kandidaten im eigenen Kern ausgeben. Konflikte mit stabilen globalen Prioritäten lösen; unabhängiges Bridson-Sampling je Chunk genügt nicht für den Randabstand.
4. Geladene Chunks in einer sparsamen Map mit begrenztem Cache halten; vor dem Entladen Änderungen sichern. Speichern: Spezifikation, Seed, Generatorversion, Makroplan und Zell-/Objektdiffs. Versionswechsel dürfen bestehende Welten nicht stillschweigend neu generieren.

Diese Punkte sind Forschungsrichtungen. Ein Austausch der `World`-Speicherung oder eine dauerhafte Generatorwahl braucht die Entscheidung im Epic und gegebenenfalls eine ADR.

## Ausführbarer Prototyp

`packages/world/src/generator/chunk-path-prototype.ts` exportiert:

- `prototypeSurface(seed, x, y)`: koordinatenbasiertes interpoliertes Höhenfeld; einfacher Fluss bei x=30…33 über der Chunkgrenze x=32.
- `generatePrototypeChunk(world, cx, cy)`: erzeugt nur die angeforderte horizontale Chunkspalte, einschliesslich abgeschnittener Randchunks. Bereits belegte Spalten werden übersprungen, damit wiederholtes Laden Änderungen nicht überschreibt. Das setzt voraus, dass Terrain vor Objekten und Wegen erzeugt wird; belegte unvollständige Spalten werden nicht repariert.
- `connectPrototypePath(world, start, goal)`: deterministisches A* auf der obersten begehbaren Fläche. Kosten: 1 je Schritt, +3 je Höhenstufe, +8 je Wasserzelle. Manhattan-Heuristik bleibt zulässig, da jeder Schritt mindestens 1 kostet. Feste Nachbarreihenfolge bricht Gleichstände reproduzierbar. Erst ein vollständiger Plan verändert Zellen: Steinboden auf Land, Planken über Wasser bei Fusshöhe z=3. Wasser bleibt darunter erhalten.

Beispiel für eine Anfrage und Verbindung (alle Koordinaten in Zellen):

```ts
import { World, generatePrototypeChunk, connectPrototypePath } from "@evermore/world";
const world = new World({ width: 70, depth: 40, height: 8, seed: 42 });
for (let cy = 0; cy < world.chunksY; cy++) {
  for (let cx = 0; cx < world.chunksX; cx++) generatePrototypeChunk(world, cx, cy);
}
const path = connectPrototypePath(world,
  { x: 4, y: 16, z: world.heightAt(4, 16) },
  { x: 64, y: 16, z: world.heightAt(64, 16) });
// null means unreachable or the experiment's search budget was exhausted.
```

Tests: `pnpm --filter @evermore/world test`. Die neuen Tests vergleichen serialisierte Welten bei umgekehrter Chunkreihenfolge und anderem Seed, prüfen Teilchunks, globale Höhensamples, sparsame Allokation und den Erhalt von Änderungen. Sie prüfen auch deterministische Wege über den Fluss, Wasser unter dem Deck, sämtliche Wegzellen mit `isWalkable`, Nachbar-/Höhenabstände, Hindernisumwege und unveränderte Welten bei unerreichbaren Zielen.

Grenzen: nur eine Oberfläche pro Spalte, kein Innenraum-/Mehrgeschoss-Pathfinding; ein Zelle breiter Weg; fixe Brückenhöhe, keine Struktur-Metadaten, Spannweiten oder Geländer; Terrain-Version ist im Hash-Label fest eingebaut. Kein Streaming-Renderer, Eviction, Diff-Speicher, Poisson-Disk oder WFC implementiert. Die Frontier wird linear gescannt und nach 20 000 Expansionen abgebrochen: für einen kleinen Vergleich geeignet, für grosse Suchgebiete wären Heap und hierarchische Suche nötig. Noch keine Aussage zur ästhetischen Qualität oder Laufzeit grosser Welten. G1 und seine Lab-Seite bleiben unverändert.
