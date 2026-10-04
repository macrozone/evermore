# Kleine Pixel-Art-Assets: Modelle und Generierungswege

Recherche zu **evermore-1fo.31**, Stand **2026-10-04**. Vorschlag für weitere Experimente, **keine Produktentscheidung**. ADR 0010 und Art Bible bleiben massgebend; die feste Palette dieses Tests ist keine neue Art-Direction-Vorgabe.

## Ergebnis

Für schnelle Varianten im bestehenden Vertex-Setup bleibt **Gemini 3.1 Flash-Lite Image bei 1K, danach Downscale** der vorläufige Default-Vorschlag: im Test 3,76 s Median und ungefähr $0,03363 pro erzeugtem Asset. **Gemini 3.1 Flash Image bei 512 px** ist die getestete Alternative: 5,21 s und $0,04489. Kleinerer nativer Output spart gegenüber Flash bei 1K etwa ein Drittel der Bildkosten, unterbietet hier aber weder Kosten noch Median von Flash-Lite bei 1K. Das ist eine Beobachtung aus drei Requests je Ansatz, keine allgemeine Leistungszusage.

Für **native 16–64 px** sind PixelLab und Retro Diffusion technisch interessantere Kandidaten als allgemeine Bildmodelle. Ihre Qualitäts- und Durchsatzvorteile sind hier **nicht empirisch belegt**. Es fehlen Anbieterzugänge; wir haben keine Drittanbieter-Testbilder und behaupten keine gemessenen Ergebnisse dafür. Imagen Fast ist auf Vertex keine aktuelle Alternative: der Test lieferte 404; die [offizielle Imagen-Seite](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/imagen/4-0-generate) führt Fast, Standard und Ultra als seit 2026-06-30 eingestellt auf. Die Preisübersicht enthält weiterhin historische Imagen-Zeilen und ist allein kein Verfügbarkeitsnachweis.

## Umfang und Versuchsaufbau

**Sechs getestete Generierungsoptionen, drei verschiedene Modell-IDs, 18 echte Testbilder.** Die Optionen umfassen Auflösung und Referenzstrategie; sie sind ausdrücklich **kein Benchmark von sechs unabhängigen Modellen oder Anbietern**. Je Option liegen Baum, Haus und Gras vor, mit identischem primären Stil-/Motivtext. Die geführte Referenzoption fügt einen separaten Hinweis zur Rolle des Referenzbildes hinzu. Zwei fehlgeschlagene Capability-/Verfügbarkeitsproben sind gesondert archiviert.

- Projekt `maw-evermore`, Vertex `global`, sequenzielle Einzelrequests mit ADC; keine parallelen Requests, keine automatischen Wiederholungen.
- Je Motiv ein Bild, keine Seed-Vorgabe, keine Auswahl des besten Bildes. Startzeit, Dauer, Modell, tatsächliche Abmessungen und Token-Verbrauch stehen in den JSON-Dateien und [measurements.json](measurements.json).
- Grundprompt: cozy SNES RPG, achsenparallele Top-down-Sicht von Süden, scharfe Pixelcluster, Terrakotta/Creme/Holz/Salbeigrün, Licht von links oben. Vollständige Texte und Request-Parameter liegen je Bild in `*.request.json`.
- Baum/Haus: Magenta-Hintergrund zur anschliessenden Freistellung; Gras: vollflächig und in beiden Achsen kachelbar angefordert. Keine Texturkorrektur, keine Retusche und keine Ersatzbilder.
- Die Referenz ist das bestehende Brunnenbild aus `apps/www/public/objects/source/well.png`; [reference-well.png](reference-well.png) friert es ein. SHA-256 steht in der Provenienz. Der naive Versuch gibt keine Referenzrolle vor; der geführte Versuch fordert ausdrücklich nur Stil, Licht, Pixelcluster und Kamera, ohne Brunnenbestandteile zu kopieren.
- Rohbilder bleiben erhalten. Rückgaben waren JPEG ohne Alpha; PNG-Dateien speichern deren dekodierte Pixel verlustfrei. Magenta-Key, Nearest-Neighbor auf 16/32/64 px, optional dieselbe 12-Farben-Experimentpalette. Kein Crop: unterschiedliche Motivgrösse im Ausgangsbild bleibt sichtbar und beeinflusst Lesbarkeit. Produktion kann separat den bestehenden Sprite-Crop verwenden.
- [Galerie](gallery.html) zeigt neben der Palette auch die unveränderten Farben nach Downscale. [Kontaktbogen](comparison.png) zeigt die Palette-Versionen; `grass-tiled.png` zeigt jeweils eine 3×3-Wiederholung.

## Vergleich der sechs getesteten Optionen

Qualität und Stil sind visuelle Einschätzungen **dieser** Bilder. Transparenz, Pixelmasse, Requests und Latenzen wurden zusätzlich maschinell geprüft. „Key“ bedeutet nachträglich erzeugtes Alpha; keines der Rohbilder hatte Transparenz.

| Option / drei Testbilder | Qualität bei 16 / 32 / 64 px | Stiltreue und Konsistenz | Nahtlose Texturen | Transparenz | Latenz Median (Min–Max), s | Geschätzte USD/Asset | Output-Lizenz | API / Self-Hosting |
|---|---|---|---|---|---|---|---|---|
| Flash-Lite 1K: [Baum](flash-lite/tree.png), [Haus](flash-lite/house.png), [Gras](flash-lite/grass.png) | 16: Symbol erkennbar, Details verschwinden; 32: brauchbar; 64: klar | Passende Farben und Kamera; Haus deutlich grösser im Frame als bei Flash, Pixelcluster nicht strikt gleich | Gleichmässiges, ruhiges Gras; niedrigster Randfehler unter korrekten Motiven, nicht exakt kantenidentisch | Roh nein; Key erfolgreich | 3,764 (3,183–7,002) | 0,03363 | Google Cloud Generated Output, siehe unten | Vertex API; keine lokalen Gewichte |
| Flash 1K: [Baum](flash/tree.png), [Haus](flash/house.png), [Gras](flash/grass.png) | 16: Haus stark reduziert; 32: Dach/Tür erkennbar; 64: Baum detailreich | Einzelmotive passend; Haus viel kleiner als Baum, mehr feine Cluster; warme Flecken im Gras | Wiederholungsmuster und grössere Randsprünge, Prüfung/Reparatur nötig | Roh nein; Key erfolgreich | 7,903 (7,893–9,603) | 0,06727 | Google Cloud Generated Output | Vertex API; keine lokalen Gewichte |
| Flash 512: [Baum](flash-512/tree.png), [Haus](flash-512/house.png), [Gras](flash-512/grass.png) | 16: grob lesbar; 32: brauchbar; 64: klar genug für kleine Sprites | Ähnliche Formsprache, weniger hochauflösende Details; Motivmassstab weiterhin variabel | Plausibles Gras; nicht exakt kantenidentisch | Roh nein; Key erfolgreich | 5,211 (5,003–8,145) | 0,04489 | Google Cloud Generated Output | Vertex API; keine lokalen Gewichte |
| Pro 1K: [Baum](pro/tree.png), [Haus](pro/house.png), [Gras](pro/grass.png) | 16: Gras nach Downscale fast flach; 32: lesbar; 64: gute Details | Saubere Einzelmotive, kein klarer Mehrwert nach starker Verkleinerung; ursprüngliche Details werden verworfen | Kleine Muster, Randsprünge; keine Garantie | Roh nein; Key erfolgreich | 22,248 (20,334–26,819) | 0,13896 | Google Cloud Generated Output | Vertex API; keine lokalen Gewichte |
| Flash 1K + naive Referenz: [Baum](flash-reference/tree.png), [Haus](flash-reference/house.png), [Gras](flash-reference/grass.png) | **Motivtest fehlgeschlagen** bei allen Grössen: Brunnen kopiert | Hohe Referenzähnlichkeit, falsche Semantik; kein brauchbarer Asset-Satz | Randfehler 0, aber ein Brunnen statt einer Grastextur: metrischer Fehlalarm | Roh nein; Key erzeugt, Assets trotzdem unbrauchbar | 11,368 (9,402–12,812) | 0,06783 | Google Cloud Generated Output | Vertex API, Bild-Input; keine lokalen Gewichte |
| Flash 1K + geführte Stilreferenz: [Baum](flash-reference-guided/tree.png), [Haus](flash-reference-guided/house.png), [Gras](flash-reference-guided/grass.png) | 16: einfache Silhouetten; 32: brauchbar; 64: klar | Korrekte Motive, Kamera und Materialien passen zum Anker; Langzeit-Konsistenz über viele Varianten noch ungeprüft | Korrektes Gras; nicht exakt kantenidentisch | Roh nein; Key erfolgreich | 9,579 (9,204–14,236) | 0,06785 | Google Cloud Generated Output | Vertex API, Bild-Input; keine lokalen Gewichte |

Nach [Googles Cloud-Vertragsbedingungen, Abschnitt 17](https://cloud.google.com/terms/service-terms) ist Generated Output Customer Data; Google beansprucht gegenüber dem Kunden keine neuen IP-Rechte daran. Dies ist die Einordnung für **alle sechs** Vertex-Optionen, keine offene Modellgewichts-Lizenz und keine Zusicherung, dass jeder Output urheberrechtlich geschützt oder exklusiv ist.

### Kostenbasis und Variantenmengen

Geschätzt aus protokolliertem Verbrauch und den am Recherchetag aufgeführten [Vertex-Standardtarifen](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing): USD je Million Input-/Text-/Bildtokens = Lite **0,25 / 1,50 / 30**, Flash **0,50 / 3 / 60**, Pro **2 / 12 / 120**. Imagen Fast/Standard sind dort historisch mit **0,02 / 0,04** je Bild gelistet. Tatsächliche Rechnung, Währungsumrechnung und eventuelle Rabatte sind nicht gemessen.

`Kosten = (Inputtokens × Inputrate + Text-/Thinkingtokens × Textrate + Bildtokens × Bildrate) / 1.000.000`.

Bei Pro sind Thinkingtokens enthalten. Deshalb ist der gemessene Mittelwert höher als die reine 1K-Bildkomponente von $0,1344. Die Referenzoptionen enthalten zusätzliche Input-Bildtokens. Die 18 erfolgreichen Bilder kosten nach dieser Schätzung zusammen **$1,26133**; die fehlgeschlagenen Proben sind darin nicht enthalten.

Für 1.000 erzeugte Varianten ergibt die Hochrechnung etwa **$33,63 Lite**, **$44,89 Flash 512**, **$67,27 Flash 1K**, **$138,96 Pro**, **$67,85 Flash mit geführtem Anker**. Das sind Kosten pro erzeugtem Versuch. Bei einer akzeptierten Quote `p` steigen die Kosten pro nutzbarem Asset auf `Kosten/p`; Nachbearbeitung, Wiederholungen und menschliche Auswahl kommen hinzu. Drei unterschiedliche Motive liefern keine belastbare Akzeptanzquote, p95-Latenz oder Aussage über Parallel-Durchsatz.

### Kachelbarkeit und Transparenz prüfen

Die Grass-Randmetrik ist die mittlere absolute RGB-Differenz zwischen linker/rechter bzw. oberer/unterer Pixelzeile **nach 64-px-Downscale und gemeinsamer Palette**, Bereich 0–255. Das Verhältnis zu normalen benachbarten Pixeln hilft, ungewöhnliche Sprünge einzuordnen. Weder niedriger Fehler noch Randgleichheit beweisen visuell brauchbare Kacheln; eine periodische Textur kann über den Rand hinweg unterschiedliche Pixel besitzen. Die 3×3-Wiederholung und Motivprüfung bleiben notwendig.

| Option | Links/rechts MAE | Oben/unten MAE | Innere Nachbar-MAE |
|---|---:|---:|---:|
| Flash-Lite 1K | 2,26 | 3,10 | 3,20 |
| Flash 1K | 20,53 | 15,25 | 15,12 |
| Flash 512 | 6,41 | 11,46 | 8,35 |
| Pro 1K | 11,43 | 5,63 | 10,91 |
| Flash + naive Referenz (**falsches Motiv**) | 0,00 | 0,00 | 31,84 |
| Flash + geführte Referenz | 12,38 | 4,06 | 10,38 |

Magenta-Key erzeugt klare und solide Pixel in allen 12 Sprite-Derivaten pro Grössenstufe; Gras bleibt voll deckend. Das ist **Pipeline-Transparenz**, keine native Modellfunktion. Der Key entfernt Pixel, deren Rot und Blau jeweils mindestens 25 über Grün liegen; er ist für diese reservierte Hintergrundfarbe brauchbar, aber kein universeller Freisteller für violette Objekte. Die Experimentpalette vereinheitlicht Farben, kann jedoch schlechte Originalfarben kaschieren: darum sind beide Fassungen archiviert.

## Native Pixel-Art und Self-Hosting: ergänzende Quellenrecherche

Diese Kandidaten gehören zur technischen Einordnung, **nicht** zur obigen Stichprobe. Für sie existieren hier keine eigenen Baum/Haus/Gras-Outputs. Kosten und Funktionen sind Anbieterangaben; Latenz und Qualität sind ungemessen. Für einen empirischen Anbieterentscheid ist ein separater Lauf mit Zugängen nötig.

| Kandidat | 16–64 px / Konsistenz | Kacheln / Transparenz | Latenz und Kosten pro Asset | Output-/Modell-Lizenz | API / Self-Hosting |
|---|---|---|---|---|---|
| PixelLab, Bitforge/Pixflux | Native kleine Bilder; Bitforge bietet Stilreferenz, Init-Image und Palette. Qualitätsvorteil ungeprüft | Eigener Top-down-Tileset-Endpunkt; optionales Alpha | Latenz ungemessen; Bitforge 64² $0,00716, mit Alpha $0,00738; Pixflux 64² $0,00793; 16²/32² Tileset-Requests $0,0079/$0,0099 | Anbieter erlaubt kommerzielle Nutzung; Modelltraining mit Outputs nur mit schriftlicher Erlaubnis | Gehostete offizielle API, kein nachgewiesenes lokales Modellangebot |
| Retro Diffusion, RD Fast/Pro/Tile | Kleine native Pixel-Canvas; Pro unterstützt Bildreferenzen; Qualitätsvorteil ungeprüft | Tile-Endpunkte für 16–64 px; Hintergrundentfernung und Seam-Tiling-Werkzeuge | Latenz ungemessen; dokumentiert Fast $0,03, Pro $0,18, Single Tile $0,06; tatsächlichen Request mit `check_cost` prüfen | Output-Lizenz der aktuellen Hosted-API in dieser Recherche nicht verifiziert; deshalb keine Freigabe-Empfehlung | Gehostete HTTP-API; lokale Erweiterung und Hosted-API nicht als identisches Produkt behandeln |
| SDXL + `nerijs/pixel-art-xl` LoRA | Üblicherweise grössere Generierung, dann NN-Downscale; Model Card empfiehlt 8×. LoRA/Seed/Palette können Stil kontrollieren, ungemessen | Standardmodell ohne garantierte nahtlose Kacheln oder Alpha; eigene Pipeline nötig | Latenz/GPU-Kosten ungemessen. USD/Asset = GPU-USD/h × Sekunden/3600 / Batchgrösse, zuzüglich Leerlauf und Betrieb | Basis Open RAIL++-M, LoRA CreativeML OpenRAIL-M; beide Nutzungsrestriktionen prüfen | Self-Hosting mit Diffusers; Hardware/Setup erforderlich |
| FLUX.1-schnell + passende Pixel-Art-LoRA | Schnell-Variante als Basis; keine native 16–64-Pixel-Spezialisierung belegt; konkrete kompatible LoRA noch nicht ausgewählt | Eigene Tile-/Alpha-/Downscale-Pipeline nötig | GPU, Batch und Adapter bestimmen reale Kosten/Latenz; keine $0-Kosten behaupten | Schnell-Basis Apache-2.0; separate LoRA-Lizenz erforderlich, nicht pauschal mit FLUX-dev-Lizenz gleichsetzen | Lokale Gewichte / eigener Inferenzserver; Installation ungetestet |

Quellen: [PixelLab API und Preise](https://www.pixellab.ai/pixellab-api), [PixelLab Nutzungsbedingungen](https://www.pixellab.ai/termsofservice), [Retro Diffusion API-Referenz des Anbieters](https://github.com/Retro-Diffusion/api-examples/blob/main/llms.txt), [SDXL Model Card](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0), [Pixel-Art-XL LoRA Model Card](https://huggingface.co/nerijs/pixel-art-xl), [FLUX Repository des Entwicklers](https://github.com/black-forest-labs/flux).

## Empfehlungen als Forschungshypothesen

1. **Bestehendes Vertex-Experiment:** Lite 1K + deterministischer Downscale als Default weiter testen. Für freigestellte Objekte die Palette reservieren, Kamera/Motivmasse kontrollieren; 32/64 px sind in diesen Beispielen stabiler als 16 px. Der günstige Modellpreis hängt nicht von der späteren Sprite-Grösse ab.
2. **Getestete Alternative:** Flash 512, wenn sein konkreter Output besser gefällt oder Lite das Motiv verfehlt. Der [Flash-Modellkatalog](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-flash-image) nennt 512/1K/2K/4K; der Lauf bestätigt echte 512². Lite-512 lieferte [HTTP 400](flash-lite-512/tree.error.json). Die [Gemini-Anleitung](https://ai.google.dev/gemini-api/docs/generate-content/image-generation) sagt für Lite an mehreren Stellen nur 1K, obwohl eine Auflösungstabelle auch 512 aufführt: diese Inkonsistenz nicht als zugesicherte Lite-Funktion behandeln.
3. **Stilanker:** Referenzrolle immer explizit angeben. Die naive Version scheitert an Motivkopie; die geführte Version liefert die richtigen Motive. Für viele Varianten eines Baums zuerst eine gute Baum-Referenz fixieren und jede neue Variante daraus ableiten; keine lange Kette von Ausgabe-zu-Ausgabe-Edits. Beides ist ein Vorschlag für einen weiteren Konsistenztest, hier nicht gemessen.
4. **Native kleine Assets:** PixelLab zuerst separat testen, Retro Diffusion besonders für Tile-Workflows. Vorläufige Vorteilshypothese: direkter Pixel-Canvas, Referenz-/Palette-/Tile-Controls und günstige kleine Outputs. Für diese Dienste keine Default-Änderung allein aufgrund von Marketing oder Preislisten.
5. **Bodentexturen:** Kein getesteter korrekter Gras-Output wird allein aus dem Prompt als garantiert nahtlos freigegeben. Wiederholung visuell prüfen und Kanten/Autotiles deterministisch konstruieren oder einen spezialisierten Tile-Endpunkt testen. Für hochwertige 16-px-Grasflächen hilft höherer Bilddetailgrad allein wenig: Pro verliert hier beim Downscale fast sämtliche Variation.

Reproduktion ohne weitere Kosten: `generate.mjs --process-only`, `gallery.mjs`, `verify.mjs` nach [README](README.md). Die Bildproduktion verwendete Node 23.6.0; Repository-Checks und Artefaktprüfung werden mit dem vorgesehenen Node 22 ausgeführt. PNGs sind archivierte Stichproben, keine deterministisch reproduzierbaren Modelloutputs.
