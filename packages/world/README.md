# @evermore/world

Weltmodell v0 für die Experimente aus `evermore-1fo`: reine Daten, kein Rendering,
kein Framework. Generatoren erzeugen ein `World`, Renderer lesen es.

Wie `@evermore/core` wird das Package **ohne Build-Schritt** als TypeScript-Quelle
konsumiert (`exports` zeigt auf `src/index.ts`); Next.js-Apps tragen es in
`transpilePackages` ein.

```ts
import { M, createMeadowHouseWorld, serializeWorld } from "@evermore/world";

const world = createMeadowHouseWorld();
world.getCell(12, 36, 3); // Material-ID
world.isWalkable(12, 45, 3); // Spieler kann mit den Füssen hier stehen
world.heightAt(12, 36); // Oberfläche (hier: Dach)
world.heightAt(12, 36, 4); // Boden unter einem Spieler auf z = 3
world.structuresAt(12, 36, 3); // [Wohnzimmer, Haus] – Spieler ist drinnen
const bytes = serializeWorld(world);
```

## Modell

- **Koordinaten:** x nach Osten, y nach Süden (auf dem Bildschirm nach unten),
  z nach oben. Eine Zelle ist ein Würfel; die Spielerposition ist die Zelle der Füsse.
- **Zellgrid:** begrenzte Welt (`width × depth × height`) aus Chunks à 32×32×16
  Zellen, eine `Uint16`-Material-ID pro Zelle (`0` = Luft). Chunks werden erst beim
  ersten Schreiben angelegt; `world.chunks()` liefert sie für Chunk-Meshing.
- **Materialien** (`MATERIALS`, IDs in `M`): `solid` (Kollision – auch Wasser),
  `walkable` (Oberseite begehbar), `opaque`, `occludesPlayer` (darf den Spieler
  verdecken → halbtransparent rendern), `transparent`, `color` (0xRRGGBB) und
  `tileIndex` für 2D-Renderer. **IDs sind Teil des Speicherformats: nie umnummerieren
  oder wiederverwenden, nur anhängen.**
- **Bewegung:** Stehen braucht begehbaren Boden und `PLAYER_HEIGHT` (2) freie Zellen;
  ohne Treppe überwindet der Spieler höchstens `MAX_STEP_HEIGHT` (1) Zelle. Treppen
  sind deshalb Stufen à eine Zelle; Kanten ab zwei Zellen sind Klippen.
- **Strukturen:** Gebäude, Räume und Brücken als ID + Bounding-Box (`min` inklusiv,
  `max` exklusiv), Räume mit `parentId`. `structuresAt()` liefert die innerste zuerst.
- **Seeded RNG:** `createRng(seed)` (sfc32), `fork(label)` für unabhängige,
  reproduzierbare Teilströme.

## Serialisierung

`encodeWorld()` schreibt ein Binärformat (Version 1, siehe `src/serialization.ts`):
Header, Strukturen als JSON und pro nicht-leerem Chunk die Zellen run-length-kodiert
(Varints). `serializeWorld()` komprimiert das zusätzlich mit Deflate
([fflate](https://github.com/101arrowz/fflate), synchron, Browser und Node).
`measureWorld()` liefert die Grössen roh / RLE / RLE + Deflate.

## Testwelt `meadow-house`

`createMeadowHouseWorld()` (96×96×32): Wiese mit Bäumen (Stamm blockiert, Blätter
verdecken), Fluss mit Brücke, Hügel mit zwei Höhenstufen und Treppen, darauf ein Turm
mit Wendeltreppe zur Plattform, zweistöckiges Haus mit je zwei Räumen und Innentreppe.
Startpunkt vor der Haustür. Die Tests prüfen per Breitensuche, dass alles zu Fuss
erreichbar ist – und ohne Brücke bzw. Treppen eben nicht.

Gemessene Grösse (Testausgabe): 589 824 B roh, 7 570 B RLE, **1 643 B** RLE + Deflate.

Tests: `pnpm --filter @evermore/world test`.
