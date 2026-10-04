# Book of Evermore – erste UI-Scheibe

Bead: `evermore-1fo.7.1`; Route: `/lab/book`, Eintrag in der zentralen Registry.

Die zwei Fragen führen zur lesbaren Zusammenfassung; beide Antworten bleiben beim Zurückblättern und Bearbeiten erhalten. Leere Antworten erlauben kein Weiterblättern. Antworten leben nur im Komponenten-State und gehen beim Verlassen oder Neuladen verloren; die ursprüngliche UI-Scheibe generiert keine Welt. Die Erweiterung «Buch 2» unten erzeugt nun eine Spezifikation.

Der Look bleibt lokal in `apps/www/app/lab/book/book.module.css`. Papier, Tinte und Akzent sind CSS-Variablen; das Einstellpanel steuert Schriftfamilie, Schriftgrösse, Buchbreite und Animationsdauer über weitere Variablen. JSON lässt sich kopieren oder bei gesperrter Clipboard-API manuell auswählen. Systemschriften halten die Studie unabhängig von den Pixel-Komponenten und zusätzlichen Font-Downloads. Unter 700px werden die Buchseiten untereinander dargestellt; reduzierte Bewegung deaktiviert die Animation.

## Bilder und Review

- [Desktop](screenshots/book-desktop.png)
- [Mobil, 390px](screenshots/book-mobile.png)

Worauf achten: Lesbarkeit längerer Antworten, ruhige Buchtypografie und der Übergang zwischen Frage und Zusammenfassung. Die warme Papierfarbe, zurückhaltende Ornamente und der dunkle Hintergrund folgen der vorläufigen Buch-Richtung der Art Bible (ADR 0010), ohne einen allgemeinen UI-Standard festzulegen.

Offene Review-Fragen an maw: Ist die Einband-Ornamentik ausreichend? Soll sich das Umblättern später körperlicher anfühlen? Ist die mobile Stapelansicht passend?

## Validierung

Frozen-Lockfile-Installation, Typecheck, Lint, vollständige Tests und Produktionsbuild erfolgreich. Headless Chromium gegen den Produktionsserver geprüft: leere/Whitespace-Antwort blockiert Weiter, beide Fragen, Zusammenfassung, Antwort-Erhalt beim Bearbeiten, Schriftumschaltung, JSON, Clipboard-Erfolg und manueller Fallback, kein horizontaler Overflow bei 390px, reduzierte Bewegung, Registry-Link und keine Browserfehler. Screenshots nach Abschluss der Animation aufgenommen.

Runtime meldet Node 23.6 statt der vorgesehenen Node-22-Version; alle Checks waren erfolgreich.

## Buch 2: Antworten → Weltspezifikation

Bead: `evermore-1fo.7.2`. Beide Antworten gehen per `POST /api/lab/book` an eine Node-Serverroute. Die Antwort enthält G1-Spezifikation, deterministischen Seed aus beiden Antworten, Quelle (`vertex`/`example`), Modell, Laufzeit und bei Live-Ausgabe Tokenzahlen. Die aufklappbare JSON-Ansicht bleibt neben den Generierungsreglern; Änderungen an Antwort oder Modell verwerfen bisherige und noch ausstehende Ergebnisse.

Modelle: `gemini-3.5-flash-lite` (Default), `gemini-3.8-flash` (LOW thinking), `claude-sonnet-5-5`. Auswahl im Panel oder z.B. `/lab/book?model=gemini-3.8-flash`. Die Allowlist verhindert freie Provider-URLs/Modellnamen. Die bestehenden AI-SDK-Adapter verwenden für Gemini `generateContent` + `responseJsonSchema`, für Claude `rawPredict` + JSON-Tool; zusätzlich prüft G1 lokal alle Feld- und Geometriegrenzen. Trunkierte, blockierte oder ungültige Ausgaben gelangen nicht als Live-Welt in den Client.

Zugang nur auf dem Server via Application Default Credentials (`gcloud auth application-default login` lokal, Service-Account auf Cloud Run). `GOOGLE_CLOUD_PROJECT` überschreibt `maw-evermore`, `BOOK_VERTEX_LOCATION` überschreibt `eu` (EU-Host `aiplatform.eu.rep.googleapis.com`). Claude benötigt Modellfreischaltung und die Structured-Outputs-Org-Policy aus evermore-1fo.11. Credentials niemals als `NEXT_PUBLIC_*` setzen. Die Route gibt keine Tokens, Credential-Dateipfade oder rohen Providerfehler aus und speichert keine Antworten. Die einschlägigen Variablen werden für `pnpm dev` durch Turbo durchgereicht.

Ohne ADC bzw. bei Providerfehler, 12s-Budget oder ungültiger Ausgabe wird ein G1-Beispiel per grober Themenzuordnung gewählt (Wald/Küste/Wüste/Berg), sichtbar als Fallback markiert. `BOOK_VERTEX_DISABLED=true` erzwingt das ohne Authentifizierungsversuch. Beispiele interpretieren keine konkreten Schlafplätze; das wird im UI erklärt. Eingaben: genau zwei nichtleere Antworten, je höchstens 4000 Zeichen; Request-Stream höchstens 40KB. Keine Renderer-Integration in dieser Scheibe.

Quellen für die Adapter: [Vertex-Endpoints](https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/locations), [Claude Structured Outputs](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/partner-models/claude/structured-outputs), [Vertex-Quickstart](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/quickstart). Modellwahl folgt der Projekt-Recherche evermore-1fo.11; tatsächliche Verfügbarkeit hängt vom Projektzugang ab.

Reviewbilder: [Desktop mit Spezifikation](screenshots/book-specification-desktop.png), [Mobil mit Spezifikation](screenshots/book-specification-mobile.png), jeweils bewusst mit deaktivierter Live-Generierung. Worauf achten: Ist die Trennung zwischen echter Interpretation und thematischem Beispiel klar? Bleiben Antworten, Modellwahl und JSON gut lesbar, besonders bei 390px? Offene Fragen: Soll die spätere Schlafposition im Gebäude liegen (G1 v1 erlaubt Spawn nur ausserhalb), und welche semantischen Details fehlen im G1-Schema?

Validierung: 21 fokussierte API/Adapter-Tests; Headless-Chromium-Flow für beide Antworten, Modell/Query, JSON, Themen-Fallback, Ergebnisverwerfung nach Änderungen und während laufender Anfrage, Netzwerkfehler, 390px ohne horizontalen Overflow und keine Browserfehler. Modelldauern/-kosten lassen sich bei Live-Zugang über Laufzeit/Tokenzahlen vergleichen; Beispiel-Laufzeiten sind keine Modellmessung.

Live-Vergleich (2026-10-03, botanischer Waldort/Schlafzimmer über Küche, Einzelmessungen): Flash-Lite mit Geometriebeispiel lieferte eine gültige Welt in 5467ms (1790 Input-/386 Output-Tokens), Flash in 5344ms (1524/474). Geschätzte Textkosten anhand der EU-Preise aus evermore-1fo.11: ca. $0.00165 bzw. $0.00322 pro Welt, ohne Infrastruktur; wegen unterschiedlicher Promptversionen kein kontrollierter Leistungsvergleich. Frühe Flash-Lite-Ausgaben wurden verworfen; das gültige Geometriebeispiel im Prompt verbessert die Anleitung. Claude: HTTP 404 («Modell nicht gefunden oder Projektzugang fehlt»), deshalb Beispiel-Fallback; keine Aussage zur Claude-Qualität/Latenz/Kosten möglich.

## G2: direkt gezeichnete Zeichenraster

Bead: `evermore-1fo.8`. «Generation approach» schaltet zwischen G1 (weiterhin Default) und G2 um; `/lab/book?strategy=g2` öffnet G2 direkt. G2 verwendet beim Wechsel Flash mit MEDIUM thinking, alle bisherigen Modelle bleiben wählbar. Vier 24×24-Raster werden in `packages/world` strikt geprüft und direkt in Materialzellen übersetzt. Das begrenzte Format hat höchstens vier rechteckige, einstöckige Häuser: Boden auf z0, Wände und Türkopfhöhe auf z1/z2, Dach auf z3.

Der Compiler repariert deklarierte Böden, Wände, Dächer, Türen und Verbindungen vom Spawn zu Türen und markierten Wegen deterministisch. Original, reparierte Raster, Reparaturzahlen und Erreichbarkeit bleiben sichtbar; die Ebenenansicht erlaubt Original/Reparatur und Durchsicht auf tiefere Ebenen. G1 erhält eine Bodenansicht zum Vergleich. Die letzten zehn Läufe erscheinen mit Quelle, Laufzeit und Input-/Output-/Thinking-Tokens; angezeigt werden nur Läufe für dieselben aktuellen Antworten. Keine Antworten werden gespeichert.

G2 hat 90s Serverbudget, 100s Clientbudget und 8192 Output-Tokens für Flash-Lite/Claude bzw. 16384 für Flash. Der grössere Flash-Rahmen lässt Platz für Thinking und die Raster; die erste Messung mit 8192 wurde verworfen. Fehler nutzen einen klar markierten festen Cottage-Fallback mit thematischem Namen. Seine Reparaturzahlen sind keine Aussage zur Modellqualität; Laufzeit und eventuell vorhandene Tokens gehören zum gescheiterten Live-Versuch.

### Vergleichsmessung und Beobachtungen

Einzelmessungen vom 2026-10-04 (lokal; UTC-Artefakte 2026-10-03), identische Antworten: wandernder Botaniker am Wald mit Bach und Weg zum Cottage; Bett im kleinen Holzhaus. Rohdaten samt Antworten: [G1 Flash-Lite](experiments/book-g1-flash-lite.json), [G2 Flash-Lite](experiments/book-g2-flash-lite.json), [G2 Flash MEDIUM](experiments/book-g2-flash.json), [G2 mit frühem 8192-Budget](experiments/book-g2-flash-8192.json), [G1 Flash](experiments/book-g1-flash.json).

| Ansatz / Modell | Quelle | Dauer | Input / Output / Thinking | Konsistenz |
|---|---|---|---|---|
| G1 Flash-Lite | Vertex | 5509ms | 1800 / 380 / 0 | gültige semantische Spezifikation, Geometrie prozedural |
| G2 Flash-Lite | Vertex | 1925ms | 1503 / 513 / 0 | 0 Reparaturen, 81/81 Ziele erreichbar |
| G2 Flash MEDIUM, 16384-Budget | Vertex | 39920ms | 1503 / 923 / 4901 | 0 Reparaturen, 20/20 Ziele erreichbar |
| G2 Flash MEDIUM, 8192-Budget | Fallback | 37202ms | 1503 / 313 / 7865 | verworfene, trunkierte Ausgabe |
| G1 Flash LOW | Fallback | 3114ms | 1800 / 219 / 0 | ungültige Ausgabe, keine Qualitätsmessung |

Qualität: G1 Flash-Lite beschreibt Wald, Fluss, Holzhaus und botanischen Garten, der Generator entscheidet die Zellen. G2 Flash-Lite zeichnet ein betretbares Haus mit Bett, aber breite unnatürliche Streifen aus Trunks/Wegeboden und keinen Bach. G2 Flash trifft die Beschreibung besser: Bach mit Übergang, einzelne Bäume, Cottage und Bett. Geschlossene Wände, zweizellige Türkopfhöhe und die markierten Verbindungen sind bei beiden gültigen G2-Läufen bereits vor der Reparatur konsistent. Die G2-Prüfung garantiert keine Story-Treue, Innenraum-Erreichbarkeit aller Möbel oder Korrektheit nicht deklarierter Gebäude.

Kosten: Auf demselben Flash-Lite-Modell braucht G2 hier 16,5% weniger Input-, aber 35% mehr Output-Tokens als G1. Flash MEDIUM braucht zusätzlich 4901 Thinking-Tokens und erheblich länger; der verworfene erste Versuch verbrauchte ebenfalls Tokens. Die UI zeigt gemessene Tokens als Kostenproxy, keine erfundenen Dollarpreise. Wegen 24×24×4 versus 64×64×40 und nur einer Messung pro Konfiguration folgt daraus keine allgemeine Kosten- oder Qualitätsrangliste.

Reviewbilder: [G2 mit Reglern und Rohdaten](screenshots/book-g2-controls.png), [Mobil, 390px](screenshots/book-g2-mobile.png). Sie spielen die gespeicherte gültige Flash-Lite-Antwort wieder ab. Worauf achten: Ebenenregler, Original/Reparaturvergleich, klare Kennzeichnung des Fallbacks und das Missverhältnis zwischen formaler Konsistenz und visueller Qualität. Offene Frage: Lohnt sich Flash MEDIUM angesichts der längeren Dauer, oder ist die semantische G1-Spezifikation mit prozeduraler Umsetzung für grössere Welten geeigneter?

Validierung: Parser-/Compiler-Tests für Materialzellen, unveränderte Rohdaten, geschlossene Wände, Bodenlöcher, blockierte Türen, alle vier Türseiten, Wasserbarrieren und fehlerhafte Raster. API-Tests für beide Providerformate, G2-Defaults, Reparaturen, Trunkierung mit Tokenzahlen und Deadline/Fallback. Headless Chromium prüft Strategie/Query, beide Passagen, Ebenen/Original/Durchsicht, Ergebnisverwerfung beim Strategiewechsel, Vergleichshistorie, mobile Breite und Browserfehler.

Self-review-Nachtrag: Die mobile Karte und die Ebenenregler stehen nun nebeneinander; die Karte bleibt beim Scrollen innerhalb der Vorschau sichtbar. `node scripts/check-book-g2.mjs` prüft nach `pnpm build` den Produktionsserver headless mit gespeicherten Antworten, bei 1440px und 390px, ohne bezahlte Modellaufrufe. Geprüft werden G2-Query/Default, beide Passagen, sichtbare Karte neben dem Regler, Ebenen 0/3, Original/Durchsicht, Ergebnisverwerfung, G1/G2-Historie, mobile Breite und Browserfehler; die Reviewbilder wurden dabei aktualisiert.

Installation, Typecheck, Lint und Build sind grün (lokal Node 23.6 statt Node 22). Der vollständige Testlauf scheitert zweimal am unveränderten Object-Generator-Test: Er erwartet Seed 42 im ersten parallelen Vertex-Aufruf, der tatsächlich Seed 43 enthält. Folge-Bead `evermore-k0f0y` erfasst die reihenfolgeunabhängige Prüfung; bis zur Behebung bleibt das Formula-Test-Gate offen.

## Rejection-Resume: Integration mit aktuellem main

Der G2-Branch wurde auf den aktuellen main-Stand rebased; die Konflikte in Providerroute, Buch und World-Exports sind gelöst. G2 nutzt die inzwischen eingeführten AI-SDK-Adapter (auch Claudes JSON-Tool), G1 behält Spezifikationsreparatur, einen Retry innerhalb des 12s-Budgets und die gespeicherten Renderer-Links. G2-Text- und Thinking-Tokens werden getrennt aus der SDK-Usage gelesen, damit Thinking nicht doppelt im Vergleich erscheint. Die obigen Live-Messungen stammen noch vom ursprünglichen REST-Adapter; bei diesem Resume gab es keine neuen bezahlten Modellaufrufe.

Installation, Typecheck, Lint, Build und die vollständige Testsuite sind auf Node 22.23.3 grün; der frühere Object-Test-Blocker ist auf main behoben. Headless-Checks bei 1440px und 390px prüfen zusätzlich G1-Renderer-Links/Browser-Speicherung und echte serverseitige G1/G2-Offline-Fallbacks. Die beiden aktualisierten Reviewbilder und der [G2-Startzustand](screenshots/book-g2-start.png) wurden selbst angesehen: keine Überlappungen, lesbare Buchtypografie, Karte und Ebenenregler gleichzeitig sichtbar.

## Buch 3: Erwachen in der generierten Welt

Bead: `evermore-1fo.7.3`. Buch→R1 nutzt den gemeinsamen Spec/Seed-Handoff. G1-v1 bekommt das optionale Feld `sleepingPlace: { name, buildingIndex, floor }`: Gebäudeindex und Etage sind nullbasiert, `buildingIndex: null` bezeichnet einen Schlafplatz draussen (Etage 0). Alte G1-Spezifikationen bleiben gültig und behalten ihren bisherigen Start. Die Buch-Ausgabe verlangt das Feld ausdrücklich; fehlende oder ungültige Referenzen gehen durch die vorhandene Korrektur/Retry-Logik.

`spec.spawn` bleibt der Aussen-/Weganker. Der Generator setzt ein zweizelliges Bett neben einer freien Startzelle auf der gewünschten Etage; `world.spawn` ist diese Startzelle. Draussen wird ein trockener, baumfreier Platz nahe dem Weganker reserviert. R1 zeigt Name, Startkoordinaten und lokale Generierungsdauer; Reset kehrt zum Bett zurück. Beispiel-Fallbacks heissen ausdrücklich «Example sleeping place» und interpretieren weiterhin keine individuellen Antworten.

Produktionsmessung vom 2026-10-04, Headless Chromium, botanische Waldhütte / Schlafzimmer über der Küche: Flash-Lite lieferte einen echten Vertex-Schlafplatz auf Etage 1 in 6052ms. Buch→R1 dauerte 6959ms (API/Hash plus Navigation bis Start/Canvas, ohne Screenshot- und Lesezeit); der lokale Weltgenerator brauchte 8.9ms. 1866 Input-/429 Output-Tokens ergeben mit den im Recherche-Bead `evermore-1fo.11` dokumentierten EU-Preisen (0.33/2.75 USD pro Million Tokens) eine Schätzung von 0.00180 USD Textkosten pro Welt, ohne Infrastruktur. Eine Einzelmessung, kein Latenzversprechen oder neuer Tarifvergleich. Deaktivierter Vertex-Fallback: 4ms Server / 923ms Buch→R1 / 8.7ms Weltgenerator, keine Modellkosten.

Bilder: [Buch mit Live-Ergebnis](screenshots/book-world-desktop.png), [R1 Desktop](screenshots/book-world-r1-desktop.png), [R1 390px](screenshots/book-world-r1-mobile.png), [Beispiel-Fallback](screenshots/book-world-fallback-desktop.png). Messdaten liegen daneben als `book-world-measurement.json` und `book-world-fallback-measurement.json`.

Worauf achten: Stimmen der benannte Schlafplatz und die Etage mit der zweiten Antwort überein? Der Spieler beginnt neben dem Bett und Reset bringt ihn zurück; Bewegung und Regler bleiben nebeneinander sichtbar. Die warme Buchtypografie passt zur offenen Buch-Richtung der Art Bible, die Welt bleibt eine grobe Pixel/Voxel-Studie: R1 blendet Innenräume derzeit nicht frei, deshalb erscheint der durch das Dach sichtbare Spieler optisch auf dem Dach und das Bett bleibt verborgen. Offene Review-Frage: Soll eine nächste Renderer-Scheibe beim Erwachen zuerst das Zimmer sichtbar machen?

Validierung: Installation, Typecheck, Lint, vollständige Tests und Produktionsbuild grün. Generator-Tests prüfen deterministische Schlafplätze auf allen vier Etagen, Outdoor-Start bei Wasser/Bäumen und ungültige Referenzen; R1-Kollision prüft Bewegung und einen Weg nach draussen mit voller Spieler-AABB. `scripts/check-book-world.mjs` prüft die echte Buch→R1-Navigation, exakte Startposition, Tastaturbewegung, Reset, Scrollen, Zoom 0.5/8, Idle und 390px ohne Überlappung/Overflow oder Browserfehler; sowohl mit Vertex als auch mit deaktiviertem Provider. Wiederholen mit Produktionsserver auf Port 4900: `BOOK_CHECK_LIVE=true node scripts/check-book-world.mjs`; Fallback-Server separat mit `BOOK_VERTEX_DISABLED=true`, optional `BOOK_CHECK_ORIGIN` und `BOOK_CHECK_ARTIFACT` für getrennte Artefakte. Runtime Node 23.6 statt Zielversion 22, alle Checks erfolgreich.
