# Evermore – Art Bible

> Massstab für alle visuellen Entscheidungen und für Reviews durch den Art Director (`.claude/agents/art-director.md`). Grundlage: [ADR 0010](../adr/0010-art-direction-welt-pixel-art-ui-offen.md) und [Vision, Abschnitt 5](../vision.md#5-look--feel). Lebendes Dokument: Wenn maw einem Review widerspricht oder etwas neu festlegt, wird es hier als Regel ergänzt (mit Datum). *Offen* markierte Punkte sind nicht entschieden.

## 1. Grundhaltung

- **Die Welt ist der Star.** Pixel-Art, die an SNES-Rollenspiele erinnert, aber modern sein darf.
- **Cozy Zuhause.** Das eigene Zuhause fühlt sich geborgen und warm an – sofern der Spieler nicht ausdrücklich etwas anderes wünscht.
- **Licht erzählt.** Lichtquellen erhellen ihre Umgebung sichtbar; Licht und Schatten geben Tiefe und Stimmung.
- **Einheitlich trotz Generierung.** Generierte und von Spielern gewünschte Inhalte müssen stilistisch zusammenpassen. Der Pixel-Look stilisiert und hält das zusammen.

## 2. Welt

| Thema | Regel |
|---|---|
| Stil | Pixel-Art, SNES-inspiriert; modern erlaubt: dynamisches Licht, weiche Schatten, Partikel, flüssige Animation |
| Referenzen | SNES-RPGs, *Children of Morta*, *Stardew Valley* (weitere *offen*) |
| Farben | Keine feste 16-Farben-Beschränkung. Harmonische, eher warme Grundstimmung in der eigenen Welt; Paletten pro Welt/Biom erlaubt |
| Pixeldichte | Einheitlich innerhalb einer Szene (Figuren, Objekte, Terrain gleiche Pixelgrösse); keine gemischten Auflösungen |
| Perspektive | Klassische Action-RPG-Draufsicht (schräg von oben), mit echter Vertikalität |
| Licht | Lichtquellen (Feuer, Laternen, Fenster, Magie) mit sichtbarem Lichtkegel/-abfall; Schatten mit Richtung; Tag/Nacht möglich (*offen*) |
| Lesbarkeit | Begehbares vs. unpassierbares Terrain auf einen Blick unterscheidbar; Spielerfigur hebt sich immer ab; Verdeckung durch Bäume/Gebäude halbtransparent statt verschluckend |

### Stimmungen

| Bereich | Wirkung | Referenz |
|---|---|---|
| Eigene Welt | warm, vertraut, lebendig; je nach Beschreibung des Spielers | Stardew Valley, SNES-RPGs |
| Traumwelt | leer, schwebend, schmale Pfade im Nichts | Chaos in *Hades* |
| Schattenwelt | vertraut, aber verzerrt und bedrohlich; dieselben Formen wie die eigene Welt, verdreht | Dark World (*Zelda: ALttP*), Upside Down (*Stranger Things*) |

## 3. UI

- Stil **offen** (Entscheidung `evermore-azi`). **Nicht** automatisch Pixel-Look; Pixel-Schriften und 16-Farben-Palette sind kein UI-Standard (ADR 0010).
- Erste Richtung von maw: **Formensprache von Büchern** – schlicht, elegant, Einband verschnörkelt (Ornamente, Rahmen, Prägung, Buchtypografie).
- UI tritt hinter die Welt zurück; gut lesbar.

## 4. Do's & Don'ts

**Do**
- Warmes Licht und kleine, vertraute Details rund ums Zuhause.
- Lichtquellen wirken lassen – besonders nachts.
- Einheitliche Pixelgrösse und klare Silhouetten.

**Don't**
- Pixel-Schriften und Retro-Paletten für die gesamte UI.
- Gemischte Auflösungen oder weichgezeichnete (unscharf skalierte) Pixel.
- Flaches, unbeleuchtetes Aussehen ohne Schatten.

## 5. Review-Kriterien (für den Art Director)

1. Passt es zur Grundhaltung (Welt als Star, cozy, Licht erzählt, einheitlich)?
2. Stil der Welt: SNES-Anmutung, modern umgesetzt, Pixeldichte konsistent?
3. Licht und Schatten: Lichtquellen sichtbar, Stimmung stimmig zum Bereich?
4. Lesbarkeit: Terrain, Spielerfigur, Verdeckung?
5. UI: hält es sich an die offene Richtung (Buch-Formensprache) und tritt es zurück?
6. Was fehlt in dieser Art Bible, um das zu beurteilen? → als Frage an maw.

## 6. Änderungslog

- 2026-10-02: Erstfassung aus ADR 0010 und Vision (Licht, Tag/Nacht, cozy Zuhause, UI-Richtung Buch).
