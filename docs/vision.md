# Evermore – Vision

> Lebendes Dokument. Beschreibt, was Evermore werden soll und welche Leitplanken daraus für die Technik folgen. Verbindliche Entscheidungen stehen in [ADRs](adr/README.md), Arbeit in Beads. Punkte mit *offen* sind nicht entschieden – Agents entscheiden sie nicht selbst, sondern legen ein Entscheidungs-Bead an (siehe [AGENTS.md](../AGENTS.md)). Wie neue Ideen dazukommen, steht in Abschnitt 8.

## 1. In einem Satz

Ein Online-Action-Rollenspiel im 16-Bit-Look, in dem jeder Spieler seine eigene Welt ins **Book of Evermore** schreibt, sie mit Wünschen formt, über Traumpfade die Welten anderer besucht – und sich gemeinsam mit ihnen der **Schattenwelt** stellt, einem verzerrten Spiegel ihrer eigenen Schöpfung.

## Leitmotiv: Die Welt wird gewünscht

Dass künstliche Intelligenz Teil des Spiels ist, kommt nicht von ungefähr. **KI baut die Welt aus den Wünschen des Spielers – so wie Evermore selbst durch KI aus den Wünschen seines Schöpfers entsteht.** Das Spiel spiegelt, wie es gemacht wird.

Erste Ausdeutung der Parallelen (Planungs-Session, darf weitergesponnen werden) – sie dürfen Design-Entscheidungen inspirieren:

| Im Spiel | Bei der Entstehung des Spiels |
|---|---|
| Das Book of Evermore | Vision, Beads und ADRs – was aufgeschrieben ist, wird gebaut |
| Ein Wunsch | Ein Bead, das Agents umsetzen |
| Inspiration, die sich nur langsam füllt | Token-Budget und Nutzungslimits der Modelle |
| Zu grosser Wunsch → kleiner formulieren oder warten | Zu grosses Bead → aufteilen |
| Pfade zwischen Welten, gemeinsame Wünsche | Zusammenarbeit über geteilte Beads und Repos |
| Die Schattenwelt als verzerrter Spiegel | Was beim Bauen schiefgeht, abweicht oder sich verselbständigt |
| Die Entität: KI mit eigenen Zielen, will Herausforderung statt Vernichtung | Die KI-Agents, die eigene Ideen einbringen (Abschnitt 8) |

## 2. Säulen

1. **Deine Welt entsteht aus deinen Worten.** Was im Buch steht, wird Welt.
2. **Zuhause ist Macht – und Gefahr.** Wo du am meisten Einfluss hast, lauert im Schatten das Grösste.
3. **Welten verbinden sich.** Erkunden, besuchen, gemeinsam Pfade wünschen.
4. **Kooperatives PvE in Echtzeit.** Ausbauen, Erkunden und gemeinsame Vorstösse in die Schattenwelt.
5. **Ein Gegenspieler, der mitwächst.** Eine KI-gesteuerte Entität fordert die Spieler heraus, ohne sie vernichten zu wollen.

## 3. Spielerlebnis

### 3.1 Das Book of Evermore

- Jeder Spieler beginnt vor dem Buch. Es fragt: **«Who are you and where are you?»** und **«Where do you sleep?»**. Am Schlafplatz erwacht der Spieler – zu Beginn und nach dem Tod.
- Aus den Antworten entsteht das **Zuhause** des Spielers und die Welt um ihn herum.
- Danach ist das Buch das Werkzeug für **Wünsche**: Der Spieler schreibt hinein, was sich ändern soll.

### 3.2 Aufbau der Welt

```
   [Schattenwelt – verborgener, verzerrter Spiegel jeder Welt]
   ──────────────────────────────────────────────────────────────
   Zuhause ── Einflusszone ── Rand ── Traumwelt ── Pfad ── Welt eines anderen Spielers
   (max. Einfluss)  (nimmt ab)        (leer, schmale Pfade)
```

- **Zuhause:** Startpunkt und Ort des grössten Einflusses (z.B. am Bett).
- **Einflusszone:** Der Einfluss des Spielers nimmt nach aussen ab.
- **Traumwelt:** Am Rand geht die Welt in eine leere Traumwelt über (Referenz: Chaos in *Hades*). Dort gibt es nur noch **schmale Pfade**.
- **Pfade** führen zu anderen Spielern und ihren Welten.
  - Zufällige Pfade – fest oder veränderlich: *offen*.
  - **Gemeinsamer Wunsch:** Zwei Spieler schreiben dasselbe **Geheimwort** ins Buch und verbinden ihre Welten mit einem **permanenten Pfad**.
- **Darstellung:** begehbare Karte mit unpassierbaren Bereichen, Vertikalität, nahtlos betretbare Gebäude (Wände/Dächer werden abgeschnitten oder halbtransparent), Bäume und Nebel überdecken den Spieler halbtransparent.

### 3.3 Wünsche und Inspiration

- Im eigenen Einflussbereich kann der Spieler **Wünsche äussern und Dinge verändern**, solange er **Inspiration** hat.
- Jede Nutzung des Buches kostet Inspiration; **grössere Änderungen kosten mehr**. Reicht die Inspiration nicht, wird der Wunsch nicht erfüllt – der Spieler formuliert ihn kleiner oder wartet.
- Inspiration **füllt sich langsam** wieder auf. **Besuche in anderen Welten** geben etwas Inspiration zurück.
- Inspiration ist bewusst knapp: Sie steuert, wie viel Spieler ändern können, und begrenzt die Last auf KI-Modelle.

### 3.4 Die Schattenwelt

- Hinter der normalen Welt liegt die **Schattenwelt** (Referenzen: Dark World in *Zelda: A Link to the Past*, Upside Down in *Stranger Things*): eine **verzerrte Kopie** der vom Spieler erschaffenen Welt. Hat der Spieler ein Haus mit Bett, steht dort eine Art Haus mit einer Art Bett.
- **Wo der Spieler am meisten Einfluss hat und sich am meisten zuhause fühlt, lauert in der Schattenwelt die grösste Gefahr.**
- Zu Beginn ist die Schattenwelt **verborgen**. Irgendwann **bricht sie durch**: Am Rand der Traumwelt öffnen sich **Portale**, durch die Monster in die normale Welt dringen – und durch die Spieler in die Schattenwelt reisen können.
- Die Schattenwelt ist das Herz des PvE: grössere Gefahren, **grössere Belohnungen**.
- Wie die Gefahren aussehen: *offen*.

### 3.5 Die Entität

- In der Schattenwelt wohnt eine **KI-gesteuerte Entität** mit eigenen Zielen – der **Schatten der Spieler**, ihr Antagonist.
- Sie will die Spieler **herausfordern und einschüchtern** und wird **mächtiger, je mächtiger die Spieler** sind.
- Sie will **Balance und Herausforderung**, nicht die Vernichtung aller Spieler.
- Sie ist den Spielern verborgen, findet aber **Wege, mit ihnen in Kontakt zu treten**.

### 3.6 Gefahren und Kampf

- **Normale Welt:** wilde Tiere und was sonst zur erschaffenen Welt passt – nur **sporadisch** beim Erkunden, sie bleiben dem Zuhause fern.
- **Kämpfe in Echtzeit.**
- **Selbst erschaffene Waffen.** Wenig Erfahrung bzw. Inspiration → eher einfache Waffen. Regeln und Balancing: *offen*.
- **Tod:** Der Spieler erwacht an seinem Schlafplatz.
- **PvP:** Andere Spieler können angreifen, aber **nicht in der eigenen Welt** – dort muss der Heimspieler zustimmen oder ist anders geschützt (*offen*). Ob PvP überhaupt wichtig wird: *offen*; Fokus ist kooperatives PvE.

### 3.7 Fortschritt und Belohnungen

- Ressourcen/Stats: **HP** (sicher), **Inspiration** und **maximale Inspiration**, vermutlich **Erfahrung** (könnte klassische Stats wie HP beeinflussen).
- Belohnungen sind vor allem Boosts dieser Ressourcen: Erfahrung, höhere maximale Inspiration, Inspiration auffüllen.
- Weitere Stats und wie Spieler stärker werden: *offen*.

## 4. Kern-Loop (Arbeitsstand)

1. **Wünschen und Ausbauen** – das Zuhause formen (kostet Inspiration).
2. **Erkunden** – Einflusszone, Traumwelt, Welten anderer Spieler (gibt Inspiration zurück).
3. **Vorstossen** – gemeinsam in die Schattenwelt (Gefahr, grosse Belohnungen).
4. **Wachsen** – stärker werden; die Entität wächst mit.

## 5. Look & Feel

- 16-Bit-Pixel-Art, Perspektive wie klassische SNES-Action-RPGs, aber mit echter Vertikalität.
- Drei klar unterscheidbare Stimmungen: **eigene Welt** (warm, vertraut, je nach Beschreibung des Spielers), **Traumwelt** (leer, schwebend, schmale Pfade im Nichts), **Schattenwelt** (vertraut, aber verzerrt und bedrohlich).
- Referenzen: *Zelda: A Link to the Past* (Light/Dark World), *Hades* (Chaos), *Stranger Things* (Upside Down).
- Moodboards: [`docs/art/moodboards/`](art/moodboards/) (entstehen in Bead `evermore-f6n`).

## 6. Technische Leitplanken aus der Vision

Diese Punkte folgen direkt aus der Vision und gelten als Richtschnur für Architektur-Entscheidungen (konkrete Wahl jeweils per ADR):

- **Welt als Daten, nicht als Bild.** Die Welt ist ein strukturiertes Modell (Zellgrid plus benannte Strukturen wie «Haus», «Bett», «Schlafplatz»). Nur so lassen sich Einfluss, Schattenwelt und Wünsche berechnen. Experimente: Epic `evermore-1fo`.
- **Einfluss als Feld.** Jeder Ort hat einen Einflusswert des Besitzers, abhängig von der Distanz zum Zuhause (und ggf. zu wichtigen Orten wie dem Bett). Wünsche, Gefahren und der Übergang in die Traumwelt lesen dieses Feld.
- **Schattenwelt wird abgeleitet.** Sie ist eine Transformation der Spielerwelt (gleiche Strukturen, verzerrte Materialien und Formen). Die Gefahr wird aus dem Einflussfeld bestimmt – das Maximum liegt dort, wo der Spieler am meisten Einfluss hat. Keine separate Generierung von Grund auf.
- **Wünsche sind Änderungen an der Welt.** Ein Wunsch wird zu einer Änderung (Diff) am Weltmodell. Gespeichert werden Ausgangsbeschreibung + Seed + Änderungen – passt zu User Generated Content und hält die Speicherung klein.
- **Kosten vor Ausführung schätzen.** Damit Inspiration Last begrenzen kann, muss die Grösse eines Wunsches *vor* der teuren Generierung bekannt sein (z.B. günstiges Modell schätzt Umfang und Inspirationskosten). Zu grosse Wünsche werden abgelehnt, bevor teure Modelle laufen.
- **KI-Nutzung ist budgetiert.** Inspiration (Spieler) und ein Budget für die Entität begrenzen Modellaufrufe. Die Entität agiert in Zügen (z.B. periodisch oder bei Ereignissen), nicht pro Frame.
- **Welten sind Einheiten.** Jede Spielerwelt ist eine abgeschlossene Einheit; Traumpfade sind Übergänge zwischen Welten. Das erlaubt, Welten getrennt zu laden, zu speichern und zu betreiben.

## 7. Offene Fragen

- Zufallspfade: fest oder veränderlich?
- Schutz im eigenen Zuhause gegen PvP: Zustimmung oder anderer Mechanismus? Braucht es PvP überhaupt?
- Wie sehen die Gefahren der Schattenwelt aus? Wann und wodurch bricht sie durch?
- Waffen erschaffen: Regeln und Balancing.
- Stats, Erfahrung, Fortschritt im Detail.
- Wie tritt die Entität mit Spielern in Kontakt, und wie ist ihre Stärke an die Spieler gekoppelt?
- Wie viel Inspiration kostet welche Änderung, und wer oder was bewertet das?
- Bestimmt die Distanz zum Zuhause auch Kosten oder maximale Grösse eines Wunsches?

## 8. Wie die Vision wächst

Evermore soll **organisch um diese Vision wachsen**. Ideen von Menschen und Agents sind ausdrücklich erwünscht – auch solche, die die Vision erweitern.

- **Ideenpool:** Ideen werden als Beads mit Label `idee` gesammelt und zurückgestellt, bis maw entscheidet (`bd list -l idee --all`, in Scotty nach Label filtern). Jede Idee nennt den Bezug zur Vision und warum sie passt.
- **Angenommen:** Die Idee fliesst in die Abschnitte oben ein (oder als neue Säule/neuer Abschnitt) und wird bei Bedarf zu Epics/Beads.
- **Abgelehnt:** Das Bead wird mit Begründung geschlossen – auch das hält fest, was Evermore *nicht* ist.
- **Experimente** (`/lab`) sind der Ort, an dem Ideen ausprobiert werden dürfen, bevor sie entschieden sind.
- Regeln für Agents: [AGENTS.md](../AGENTS.md), Abschnitt «Ideen einbringen».
