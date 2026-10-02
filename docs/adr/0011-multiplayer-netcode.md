# 0011 – Multiplayer und Netcode für Welten als Instanzen

- Status: proposed
- Datum: 2026-10-02
- Entscheider: maw (Entscheid ausstehend)
- Bead: evermore-kl1; Recherche: evermore-kl1.1

## Kontext und Problem

Evermore braucht Echtzeit-Kampf und kooperative Besuche in getrennten Spielerwelten sowie deren Schattenwelten. Traumpfade verbinden diese Einheiten; Wünsche verändern dauerhaft das Weltmodell, während die KI-Entität in Zügen agiert ([Vision](../vision.md)). Gesucht ist eine Architektur, die diese Regeln verlässlich durchsetzt und in der Experimentierphase bezahlbar betreibbar bleibt.

[ADR 0004](0004-cicd-catladder-github-cloud-run.md) setzt Cloud Run in `europe-west6` für bestehende Deployments voraus; [ADR 0005](0005-prisma-als-orm.md) setzt Prisma/Postgres für Projektdaten. Dieser Entwurf implementiert nichts und ändert keine angenommene ADR. Die folgenden Werte und Abläufe sind Vorschläge, keine beschlossenen Produktgrenzen.

## Betrachtete Optionen

### Vergleich

| Option | Modell / Transport / Betrieb | Vorteile für Evermore | Nachteile / Aufwand |
|---|---|---|---|
| A: Colyseus | Autoritative TypeScript-Räume, WebSocket; zunächst ein Cloud-Run-Gameserver | Raum passt zur Welt; gemeinsames TS-Modell; Synchronisation und Reconnect als Bausteine; bestehender Deployment-Weg | Spielregeln und Persistenz bleiben Eigenarbeit; Zustandsbesitz und Routing bei mehreren Prozessen lösen; Cloud-Run-Verbindungsgrenzen |
| B: Eigenes WS-Gameserver-Package | Autoritative TS-Simulation, eigenes Protokoll; Cloud Run oder VM | Volle Kontrolle über Input, kompakte Snapshots und Book-Protokoll; wenig Framework-Abhängigkeit | Räume, Delta-Encoding, Backpressure, Matchmaking und Recovery selbst entwickeln; höchster Netcode-Testaufwand |
| C: Nakama | Autoritative Matches mit festem Tick; Browser-SDK/WS; eigener Dienst auf VM oder später GKE | Multiplayer und weitere Backend-Funktionen aus einer Plattform; geeignet, wenn soziale Funktionen wichtig werden | Zweites Backend und dessen Datenhaltung/Betrieb; TS-Runtime nicht einfach ein Node-Package; Abgrenzung zu Prisma und bestehenden APIs nötig |
| D: WebRTC / Geckos.io | Bevorzugt autoritativer Node-Server mit DataChannels auf VM; alternativ Spieler als Host | Unzuverlässige Updates möglich; weniger Warten auf überholte Bewegungsdaten bei Paketverlust | UDP-Erreichbarkeit, ICE und ggf. TURN; kein direkter Ersatz hinter Cloud-Run-HTTP-Ingress; Host-Variante erschwert Vertrauen, Verfügbarkeit und Migration |

Colyseus stellt Räume und serverseitige Zustands-Synchronisation bereit. Mehrprozess-Betrieb braucht gemeinsame Presence/Matchmaking-Daten und Routing zum zuständigen Prozess; Redis repliziert dabei nicht automatisch die laufende Simulation. Grundlage: [Rooms](https://docs.colyseus.io/room), [Scalability](https://docs.colyseus.io/scalability), [Presence](https://docs.colyseus.io/server/presence).

Nakama erlaubt eigene autoritative Spiellogik in Match-Handlern mit festem Tick; auch dort müssen Regeln und Match-Lebenszyklus entwickelt werden. Die Plattform ersetzt keine Evermore-Simulation. Grundlage: [Authoritative Multiplayer](https://heroiclabs.com/docs/nakama/concepts/multiplayer/authoritative/).

Geckos.io verbindet Browser und Node über WebRTC/UDP; es ist ein Transportbaustein, keine fertige persistente Weltverwaltung. Ein DataChannel kann geordnet/zuverlässig oder mit begrenzter Wiederholung konfiguriert werden. Grundlage: [Geckos.io](https://github.com/geckosio/geckos.io), [RTCDataChannel](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel).

### Autorität und Echtzeitmodell

**Vorschlag:** Genau ein autoritativer Besitzer je aktiver Weltinstanz; mehrere logische Räume dürfen einen Serverprozess teilen. «Eine Instanz pro Welt» bedeutet daher nicht «ein kostenpflichtiger Container pro Spieler». Inaktive Welten liegen als Daten vor und werden bei Besuch geladen. Schattenwelt-Räume referenzieren die Basiswelt samt Version; parallele Änderungen brauchen explizite Versionskonflikt-Regeln.

Clients schicken Eingaben, keine verbindlichen Positionen, Treffer, Inventare oder Inspirationswerte. Server validiert Geschwindigkeit, Kollision, Reichweite, Cooldowns, Besitzrechte und Kosten. Spieler als Host spart Rechenlast, kann aber Zustände manipulieren und beim Verlassen alle Besucher unterbrechen. Für die persistente gemeinsame Geschichte ist diese Vertrauensgrenze ungünstig; Peer-to-Peer allenfalls für isolierte, nicht persistente Experimente.

Startwerte zum Messen: **30 Simulationsticks/s**, **10–20 Snapshots/s**, Rendering unabhängig bei 60 FPS. Der lokale Client sagt eigene Bewegung mit derselben Bewegungslogik voraus. Eingaben tragen Sequenznummern; Server bestätigt die letzte verarbeitete Sequenz. Client setzt auf den bestätigten Zustand zurück, spielt offene Eingaben erneut ab und glättet kleine visuelle Korrekturen. Treffer und Belohnungen bleiben serververbindlich.

Andere Spieler werden zunächst mit **100 ms Interpolationspuffer** angezeigt; bei Lücken nur kurz extrapolieren, dann stoppen statt beliebig weiterlaufen. Diese Parameter sind Ausgangshypothesen: 20/30/60 Hz gegen Last und Kampfgefühl vergleichen. Ein höherer Tick beseitigt weder Netzlatenz noch Paketverlust. Lag-Compensation für Treffer erst nach Messung und separater Regelentscheidung; kein unbeschränktes Vertrauen in Client-Zeitstempel.

### Transportvergleich

| Transport | Eigenschaften | Bewertung |
|---|---|---|
| WebSocket | Geordnete, zuverlässige Verbindung; verlorene TCP-Pakete können neuere Daten aufhalten | Startempfehlung; kleine Nachrichten, begrenzte Queues, Snapshots zusammenfassen und langsame Clients trennen |
| WebRTC DataChannel | Konfigurierbare Ordnung/Wiederholung; Signalisierung und ICE, ggf. TURN nötig | Interessant bei nachgewiesenen Verlustproblemen; kritische Ereignisse zuverlässig, Bewegungsupdates mit Sequenzen verwerfbar |
| WebTransport | HTTP/3, zuverlässige Streams und unzuverlässige Datagramme | Späterer Kandidat; Zielbrowser und Netzwerke testen, WS-Fallback sowie QUIC-fähigen Endpunkt betreiben |

WebTransport bietet beide Übertragungsformen ([API-Dokumentation](https://developer.mozilla.org/en-US/docs/Web/API/WebTransport)). Cloud Runs HTTP-Endpunkt ist keine Zusage für beliebige UDP-/QUIC-Gameserver; WebRTC/WebTransport brauchen einen nachgewiesenen passenden Ingress. Kein Transport macht eine Host-Simulation automatisch vertrauenswürdig. Das Domänenprotokoll sollte Input, Snapshot und dauerhafte Ereignisse vom Transport trennen.

### Hosting und Welt-Routing

Cloud Run unterstützt WebSockets, aber Requests haben höchstens **60 Minuten** Laufzeit. Session-Affinity ist **best effort**; neue Verbindungen können woanders landen. Offene WebSockets halten eine Instanz aktiv und kosten Rechenzeit. Min-Instances mindern Kaltstarts, sichern aber weder Zustand noch exklusiven Weltbesitz. Grundlage: [Cloud Run WebSockets](https://docs.cloud.google.com/run/docs/triggering/websockets).

**A/B, erste Phase:** Separater Gameserver-Service, nicht im Next.js-Request-Lebenszyklus. Zunächst eine aktive Revision, keine Traffic-Splits, kleine Spielerzahl; geplante Deployments mit Save/Drain/Reconnect. `min-instances=1` als bewusste Kostenwahl bei Spieltests, sonst 0. Instance-based CPU für Hintergrundarbeit erwägen. Max-Instances=1 begrenzt Last, ist aber kein globaler Lock: Revisionen/Neustarts können überlappen. Ein DB-Lease mit monotonem Fencing-Token verhindert, dass zwei Prozesse dieselbe Welt dauerhaft schreiben. Warteschlange/Ablehnung statt unkontrollierter Überlastung.

**Vor Scale-out:** Weltverzeichnis `worldId → owner/epoch`, atomare Besitzvergabe, Heartbeat und Recovery. Join muss tatsächlich den Besitzer erreichen, etwa über einen bewusst betriebenen WS-Gateway mit interner Weiterleitung; Cloud-Run-Affinity allein reicht nicht. Colyseus-Routing hinter diesem Gateway zuerst beweisen. Falls dies mehr Komplexität erzeugt als es spart, Gameserver auf einer adressierbaren VM betreiben; Website/API bleiben auf Cloud Run. Ein Wechsel des Gameserver-Hostings bedarf maws Zustimmung, ggf. einer ergänzenden ADR zu 0004.

**GKE + Agones:** Alternative für viele aktive Räume oder UDP-Bedarf. Agones verwaltet dedizierte Gameserver auf Kubernetes ([Überblick](https://agones.dev/site/docs/overview/)); Simulation, Weltdaten und Handover bleiben Anwendungscode. Es kommen Clusterpflege, Allocation, Kapazitätsreserven, Netzwerk und Drain-Regeln hinzu. Für die Experimentierphase voraussichtlich zu viel Betrieb. Eine einzelne VM ist einfacher, hat dafür einen Ausfallpunkt und braucht Updates/Backups. Managed Colyseus/Nakama wären weitere Betriebsvarianten; Preise, Region Zürich und Exportfähigkeit vor Vertragswahl prüfen, kein Angebot vorausgesetzt.

### Persistenz, Traumpfade und Buchgeschichte

Vorgeschlagene Zustandsaufteilung: laufende Bewegung im Raum-RAM; dauerhafte Seed-/Generatorversion, Welt-Diffs, Inventar, Inspiration und Ereignisse über Prisma/Postgres. Keine DB-Abfrage pro Simulationstick. Periodische Snapshots beschleunigen Laden; bestätigte dauerhafte Änderungen werden vor Bestätigung transaktional gespeichert. Bei DB-Ausfall solche Änderungen aussetzen, nicht als erfolgreich melden. Rein flüchtige Bewegung darf bei Crash zum letzten sicheren Stand zurückfallen.

Traumpfad-Handover als expliziter Zustandsautomat:

1. Quelle prüft Zugang und erzeugt eine persistente Transfer-ID mit Zielwelt und Ablaufzeit.
2. Ziel reserviert einen Platz und lädt die passende Weltversion; Timeout lässt den Spieler an der Quelle.
3. Transaktion aktualisiert den einzigen aktiven Aufenthaltsort mit Besitz-Epoch. Quellraum friert den Spieler während Commit ein.
4. Client verbindet zum Ziel mit kurzlebigem, an Spieler/Ziel/Transfer gebundenem Ticket; danach Snapshot und Freigabe der Quelle.
5. Wiederholung/Reconnect fragt den gespeicherten Transferstand ab. Idempotente Schritte und Recovery dürfen weder Inventar duplizieren noch zwei aktive Avatare erzeugen.

Für die Buchgeschichte protokolliert der Server akzeptierte semantische Aktionen mit Ereignis-ID, Akteur, Weltversion und Serverzeit: Wunsch, Pfadöffnung, Kampfresultat, Belohnung. Nicht jeden Positionsframe speichern. KI-Zusammenfassungen lesen dieses Protokoll; sie erfinden keine verbindlichen Zustandsänderungen. Aufbewahrung und Sichtbarkeit der Geschichte sind noch Produktfragen.

Die Entität läuft ausserhalb des Tick-Loops als budgetierter Auftrag in Zügen. Ergebnis ist ein validierter Befehl gegen eine bestimmte Weltversion; der Raum übernimmt ihn an einer Tick-Grenze. Veraltete Ergebnisse werden verworfen/neu geplant. Kein LLM-Aufruf blockiert Echtzeit-Kampf; Schattenwelt und normale Welt folgen demselben Autoritätsprinzip.

### Kostenabschätzung und Betriebsaufwand

Stand der Recherche: 2026-10-02, USD, 730 Stunden/Monat. **Planungsmodell, kein Zürich-Angebot:** Die öffentlich auslesbare Cloud-Run-Tabelle zeigt standardmässig Iowa mit instance-based Listenpreisen von 0.000018 USD/vCPU-s und 0.000002 USD/GiB-s. Region, Billing-Modus, Währung und Freikontingent ändern die Rechnung ([Preisquelle](https://cloud.google.com/run/pricing)). Region `europe-west6` muss vor Provisionierung im Calculator ausgewählt werden.

Formel: `aktive Instanzstunden × 3600 × (vCPU × CPU-Preis + GiB × RAM-Preis)`.

| Szenario | Rechenbasis / eigene Budgetannahme | Monatlicher Compute-Rahmen |
|---|---|---|
| A/B: kurze Spieltests | 1 vCPU + 1 GiB, 60 aktive Stunden, ohne warmen Leerlauf | 4.32 USD Referenz; bis 6.05 USD bei +40 % Preis-Sensitivität |
| A/B: ein stets aktiver Prozess | 1 vCPU + 1 GiB, 730 Stunden | 52.56 USD Referenz; bis 73.58 USD bei +40 % |
| A/B: zehn solche Prozesse | Gleiche Ressourcen, jeweils 730 Stunden | 525.60–735.84 USD; keine Aussage zur tragbaren Spielerzahl |
| C: Nakama auf VM | Eigene Annahme 0.08–0.25 USD/h für einen kleinen Dienst mit Reserve | 58.40–182.50 USD; Datenbank separat |
| D: Geckos/Host | Dedizierter Server wie VM-Annahme oben; Peer-Host verschiebt CPU zu Spielern | 58.40–182.50 USD beim Server; Peer-Kosten hängen von TURN-Anteil ab |
| GKE/Agones als Hosting-Alternative | Beispiel: 3 Nodes zu angenommenen 0.10–0.25 USD/h, plus Cluster | 219–547.50 USD Nodes + 73 USD Clustergebühr vor Credits |

Die VM-/Node-Sätze und +40 % sind bewusst **Annahmen**, keine verifizierten regionalen Tarife. GKEs Listen-Clustergebühr beträgt 0.10 USD/h, Credits hängen von Cluster/Billing ab ([Preisquelle](https://cloud.google.com/kubernetes-engine/pricing)). Alle Zahlen schliessen DB, Disks, Backups, Redis, Load-Balancer, TURN, Egress, Logs, KI, Steuern und Arbeitszeit aus. Min-Instances-Leerlauf nicht als gratis annehmen.

Egress separat dimensionieren: angenommene **2 KiB/Snapshot × 20/s × 100 gleichzeitige Spieler × 100 Spielstunden ≈ 1.37 TiB** ausgehende Nutzdaten, ohne Protokoll-Overhead. Preis ergibt sich aus Destination und Tarif; interest management und Deltas können wichtiger sein als Compute. Raumkapazität erst benchmarken, nicht aus Cloud-Run-Connection-Limits ableiten.

Relativer Betrieb: A gering bis mittel (Routing erhöht ihn), B mittel plus hoher Entwicklungsaufwand, C mittel bis hoch durch weiteres Backend, D mittel bis hoch durch Netzwerk/Relay, GKE hoch. Dies ist eine Einschätzung für dieses Team, keine Herstellerzusage.

## Entscheidung

**Noch nicht gewählt. Empfehlung an maw: Option A, Colyseus mit autoritativen Welträumen über WebSocket**, zunächst begrenzter Cloud-Run-Pilot in Zürich. B ist Rückfalloption, wenn ein kleiner Prototyp zeigt, dass Colyseus den benötigten Bewegungs-/Persistenzfluss erschwert. C wird attraktiver, wenn ein umfangreiches Multiplayer-Backend gebraucht wird; D erst bei gemessenen Transportproblemen. GKE/Agones ist eine spätere Hosting-Option, kein Startzwang.

Vor Annahme bestätigen: Zielgrösse pro Welt (Testannahme 2–8 Spieler), akzeptiertes Monatsbudget, Recovery-/Wartungsunterbrechungen und ob Gameserver bei Bedarf ausserhalb Cloud Run erlaubt sind. Empfehlung und Zahlen bleiben bis zu maws Entscheidung auf `evermore-kl1` unverbindlich.

## Konsequenzen

- Positiv bei Annahme: eindeutige Autorität für dauerhafte Weltänderungen; Raumgrenzen passen zu Traumpfaden; TS/WS nutzt vorhandene Fähigkeiten.
- Negativ / Risiken: Prediction, Crash-Recovery, Transfer und DB-Fencing bleiben Arbeit; Cloud Run ist kein zustandsbewusster Match-Router; WS kann unter Paketverlust stauen.
- Anti-Cheat-Grundhaltung: authentifizierter Join, serverseitige Rechte-/Regelprüfung, Input-Raten-/Grössenlimits und Replay-Schutz. UGC und KI-Befehle validieren wie fremde Eingaben. Keine absolute Cheat-Freiheit versprechen.
- Region: `europe-west6` ist der Startort gemäss ADR 0004, keine gemessene Latenzgarantie. RTT/Jitter/p95 unter Schweizer und weiteren europäischen Anschlüssen messen. Vorläufige Testziele: RTT p95 unter 100 ms im Zielgebiet und Tick-Dauer p95 unter 33 ms; Budget für Interpolation gesondert erfassen.
- Folgearbeiten nach Entscheidung: Zwei-Browser-Prototyp mit Bewegung/Kampf, 50/100/200 ms RTT und 1/3/5 % Verlust; Reconnect über 60 Minuten, Restart/Deploy, Doppel-Join, DB-Ausfall und abgebrochener Traumpfad. Datenverbrauch, Tick-Last und Korrekturen messen, Chrome/Firefox/Safari sowie Mobilnetz prüfen. Diese Umsetzung ist nicht Bestandteil der Recherche.
