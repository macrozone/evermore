# PRD: Wünsche & Inspiration

> Entwurf (Koordinator: Planungs-Session, 2026-10-03). Breite vor Politur; Unsicherheit wird offen benannt. Quellen: `docs/vision.md` (v.a. 3.1, 3.3, 6, 8), `docs/art/README.md`, ADRs 0007–0010, Experimente im Epic `evermore-1fo` (Buch-Intro 1fo.7, Kostenschätzung 1fo.12, Generator 1fo.5, Weltmodell `packages/world`).

## Problem Statement

Evermores Kernmechanik: Spieler verändern ihre Welt, indem sie **Wünsche ins Book of Evermore schreiben**. Eine KI setzt den Wunsch als Änderung am Weltmodell um. Jeder Wunsch kostet **Inspiration**, eine knappe Ressource, die sich langsam regeneriert und durch Besuche in fremden Welten zurückkommt. Inspiration ist zugleich Spielmechanik und Kostenbremse für KI-Aufrufe.

Heute gibt es: ein Weltmodell v0 (Zellgrid, Materialien, Strukturen), ein Buch-UI ohne LLM (1fo.7.1), Pläne für einen Generator aus einer Weltspezifikation (1fo.5) und ein geplantes Experiment zur Kostenschätzung (1fo.12). Es fehlt ein durchgängiges Konzept: vom Freitext-Wunsch über Bewertung, Kosten, Umsetzung, Darstellung bis zur Speicherung – inklusive Grenzen, Missbrauchsschutz und Spielgefühl.

## Goals

1. Ein Spieler kann im eigenen Einflussbereich einen Wunsch als Freitext äussern und sieht das Ergebnis in der Welt (Ziel: wenige Sekunden bis < ~15 s für kleine/mittlere Wünsche).
2. Vor der teuren Umsetzung wird der **Umfang geschätzt** und in **Inspirationskosten** übersetzt; zu grosse Wünsche werden abgelehnt oder es wird eine kleinere Variante vorgeschlagen (Idee `evermore-0db`).
3. Inspiration als Ressource: Verbrauch, Regeneration über Zeit, Rückgewinn durch Besuche; Maximum wächst mit Fortschritt.
4. Wünsche werden als **Änderungen (Diffs) am Weltmodell** gespeichert (Ausgangsbeschreibung + Seed + Diffs), deterministisch reproduzierbar.
5. Ergebnisse passen stilistisch zur Welt (Art Bible: Pixel-Art, SNES-inspiriert, cozy Zuhause, Licht).
6. KI-Kosten pro Spieler sind begrenzt und messbar.

## Non-Goals (für diese Ausbaustufe)

- Schattenwelt-Ableitung, Entität, Kampf, Waffen erschaffen (eigene Themen).
- Multiplayer-Synchronisation und Pfade zwischen Welten (Recherche `kl1.1` separat); Besuche nur als Inspirationsquelle konzeptionell.
- Monetarisierung.
- Öffentliche Moderation im Produktivbetrieb (nur Grundsatz/Leitplanke, siehe Idee `lqq`).

## User Stories / Scenarios

- **Klein:** «Ein Blumentopf neben meinem Bett.» → geringe Kosten, sofort sichtbar.
- **Mittel:** «Ein Gemüsegarten hinter dem Haus mit einem Zaun.» → mehrere Zellen/Objekte, mittlere Kosten.
- **Gross:** «Ein Schloss auf einem Berg.» → übersteigt Inspiration → Ablehnung oder Vorschlag «ein kleiner Turm auf dem Hügel».
- **Stimmung:** «Mach es abends gemütlicher.» → Licht/Atmosphäre statt Geometrie.
- **Entfernen/Ändern:** «Der Baum vor dem Fenster soll weg.» / «Das Dach soll rot sein.»
- **Ausserhalb des Einflusses:** Wunsch am Rand der Traumwelt → teurer oder nicht möglich.
- **Unklar/unsinnig/unangemessen:** «Mach alles besser.» / anstössiger Inhalt → Rückfrage bzw. Ablehnung.
- **Rückgängig:** Spieler bereut einen Wunsch – ist Undo möglich, und was kostet es?

## Constraints

- KI über Google Cloud Vertex AI (EU-Multiregion), Default `gemini-3.5-flash-lite`; Vergleichsmodelle möglich (Recherche `1fo.11`). Credentials nur serverseitig.
- Weltmodell `packages/world` (TypeScript, framework-frei); Generator deterministisch mit Seed.
- Browser-Client (Next.js `apps/www`), Experimente unter `/lab`.
- Art Bible als Stil-Massstab; Inspiration darf das Spielgefühl nicht frustrierend machen (Leitmotiv: knappe Inspiration spiegelt knappe Modell-Kontingente).
- Code/UI englisch, Doku deutsch.

## Open Questions

1. Welche **Repräsentation** liefert das LLM: direkte Zelländerungen, eine semantische Änderungsbeschreibung (z.B. «add structure garden at x,y with fence»), die ein deterministischer Generator umsetzt, oder Bausteine aus einer Bibliothek?
2. Wie wird der **Ort** bestimmt (Spielerposition, Blickrichtung, Text «hinter dem Haus»)?
3. **Kostenmodell:** Umfang (Zellen/Strukturen/Komplexität) × Distanz zum Zuhause (Einflussfeld)? Fixkosten pro Wunsch?
4. **Regeneration:** Rate, Offline-Regeneration (Idee `1ye`), Obergrenze; wie viel bringt ein Besuch?
5. Wie viele **Versuche/Varianten** zeigt man (Vorschau vor dem Bestätigen?) und wer bezahlt fehlgeschlagene Generierungen?
6. **Undo/Historie:** Diffs rückgängig machen; Kosten-Rückerstattung?
7. **Konsistenz/Stil:** Wie verhindern wir Stilbrüche und kaputte Geometrie (Türen erreichbar, Wege begehbar)? Validierung + Reparatur?
8. **Moderation:** Prüfung im selben LLM-Schritt wie die Kostenschätzung?
9. **Latenz:** Streaming/Platzhalter während der Generierung?
10. Was ist das **MVP** für ein spielbares Experiment unter `/lab`?

## Rough Approach

1. **Wunsch-Pipeline** (Server-Route): Freitext + Kontext (Ort, Einflusswert, Umgebung als kompakte Beschreibung) → günstiges Modell → strukturierte **Wunsch-Spezifikation** (Absicht, Ort, Umfang, Bausteine, Moderationsurteil) + **Kostenschätzung**.
2. **Gate:** Inspiration reicht? Sonst Ablehnung oder kleinere Variante vorschlagen.
3. **Umsetzung:** deterministischer Generator setzt die Spezifikation als Diff aufs Weltmodell um (Bausteine wie im Generator 1fo.5); Validierung (begehbar, keine Überlappung) und Reparatur.
4. **Darstellung:** Diff in R1/R2 sichtbar machen, kleine Animation («Buchstaben werden Welt»).
5. **Persistenz:** Diff + Spezifikation + Kosten als Eintrag in der Wunsch-Historie der Welt.
6. **Inspiration-Service:** Kontostand, Regeneration, Rückgewinn bei Besuchen, Obergrenze.
7. **Experiment** `/lab/wish` (baut auf 1fo.12 auf) mit 20–30 Beispielwünschen, Kosten-/Latenz-Messung.
