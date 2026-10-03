# SAM 3D Objects – Recherche

Stand 04.10.2026, erste Offline-Scheibe von `evermore-1fo.29`. Die technische
Pipeline passt zur hybriden Objektbibliothek (Vision §6), ohne das offene
Weltformat zu entscheiden. Gemessen wurde hier keine SAM-Inferenz.

## Lizenz

Primärquelle: [SAM License](https://github.com/facebookresearch/sam-3d-objects/blob/main/LICENSE),
Version 19.11.2025. Sie erlaubt gebührenfrei Nutzung, Kopieren, Ändern und
Weitergabe; eine Nicht-kommerziell-Klausel ist nicht enthalten. Bei Weitergabe
von SAM-Materialien bzw. Ableitungen gelten deren Bedingungen und die Pflicht,
eine Lizenzkopie beizulegen. Forschungspublikationen müssen die Nutzung nennen.
Reverse Engineering und bestimmte Trade-Control-/ITAR-Endnutzungen sind untersagt;
IP-Klagen können die Lizenz beenden. Outputs werden in den Haftungsregeln erwähnt,
aber nicht mit einer eigenen Weitergabesperre versehen. Daraus folgt als
Wortlaut-Lektüre: generierte Spiel-Assets erscheinen kommerziell nutzbar;
das ist keine abschliessende rechtliche Freigabe. Eingaberechte und Rechte
Dritter bleiben separat zu prüfen. Die frühere Kurzlektüre im Bead ist damit
konsistent; Produktion braucht die dort verlangte rechtliche Gegenprüfung.

## Betrieb

| Route | Beleg / Grenze | Ergebnis hier |
|---|---|---|
| Offiziell lokal | [Setup](https://github.com/facebookresearch/sam-3d-objects/blob/main/doc/setup.md): Linux 64-bit, NVIDIA ≥32 GB VRAM; Gewichte brauchen HF-Zugang und Authentifizierung | Darwin arm64, deshalb kein offizieller Lauf |
| Apple Silicon Community | [MPS-Port](https://github.com/ankitmahala07/sam3d-objects-mac): Entwickler berichtet staged inference auf Macs mit etwa 24–30 GB Unified Memory, Python 3.11, ca. 12 GB Gewichte. [Zweiter Port](https://github.com/ZimengXiong/Sam3D-Objects-MLX) als weiterer Prüfpunkt | Kandidaten existieren entgegen der älteren Planungsnotiz; nicht installiert/validiert, keine lokale Laufzeitbehauptung |
| Meta-Playground | [Offizieller Demo-Link](https://www.aidemos.meta.com/segment-anything) aus dem [Upstream-Repo](https://github.com/facebookresearch/sam-3d-objects) | Manuelle Route für erste Exporte; keine dokumentierte Batch-API in den geprüften Quellen |
| HF Space/Inference | [Model Card](https://huggingface.co/facebook/sam-3d-objects) nennt Community-Spaces; Checkpoints sind zugangsbeschränkt | Kein freier, verifizierter Inferenz-Endpunkt hier. Die abgefragte vermutete facebook-Space-URL lieferte Authentifizierungsfehler; sie belegt keine generelle Nichtverfügbarkeit |
| GCP VM / Vertex custom prediction | [GPU-Übersicht](https://docs.cloud.google.com/compute/docs/gpus): NVIDIA-Instanz mit ausreichendem VRAM, passende CUDA-Abhängigkeiten, Gewichte und Quota nötig | On-demand GPU nur nach maws OK laut Bead-Kommentar; keine Ressource gestartet |
| Cloud Run | [GPU-Doku](https://docs.cloud.google.com/run/docs/configuring/services/gpu): L4 24 GB und RTX PRO 6000 Blackwell 96 GB; letzteres mindestens 20 CPU/80 GiB RAM | L4 unter offizieller VRAM-Voraussetzung. Blackwell hat genügend Speicher, aber CUDA/PyTorch-Kompatibilität ist ungetestet; nicht pauschal ausschliessen oder als lauffähig zusagen |

Die offiziellen Installationsschritte umfassen CUDA/PyTorch3D-Abhängigkeiten und
einen autorisierten Download. Unified Memory ersetzt diese CUDA-Kernel nicht.
Der MPS-Port ist ein anderer, ungeprüfter Ausführungspfad. Ein Hosted-Demo-Test
und ein Mac-Port-Test müssen deshalb getrennte Provenienz erhalten.

## Kosten und Laufzeit

Es gibt hier keine gemessene Objektlaufzeit. Nicht aus Demo-Gefühl oder
Papier-Benchmarks einen Preis für diese Pixelobjekte ableiten. [Cloud Run
Pricing](https://cloud.google.com/run/pricing) und [Compute GPU Pricing](https://cloud.google.com/compute/gpus-pricing)
sind regions-/konfigurationsabhängig; vor einem bewilligten Lauf ein konkretes
Angebot festhalten. Gesamtkosten pro erfolgreichem Objekt:

`(Setup + Gewichte laden + Warmhalten + Inferenz + Retries) × Gesamtinstanzpreis / erfolgreiche Objekte + Storage/Netzwerk`.

Reines Rechenbeispiel, **kein GCP-Listenpreis und keine Messung**: bei angenommenen
2 USD/Stunde und 30–120 Sekunden wären die Inferenzsekunden 0,017–0,067 USD/Objekt;
20 Minuten Setup für vier Objekte addierten 0,167 USD/Objekt. Kalte Downloads,
CPU/RAM und Stilllegung bestimmen oft mehr als die Modellsekunden. Lokal entstehen
keine Cloud-GPU-Gebühren, aber Energie, Speicher und lange Laufzeit bleiben.
Cloud Run rechnet GPU über die Instanzlebensdauer ab; Modellladen kommt zusätzlich
zum dokumentierten Instanzstart hinzu. Inferenz immer offline/budgetiert, nie pro Frame.

## Ausstehende Bewertung

Die vorbereiteten Masken prüfen Eingangsdaten, nicht Rückseiten. Ob pixelige
Fachwerkdetails, Blattgruppen, Brunnenloch und schmale Laternenpfosten erhalten
bleiben, ist erst mit echten Exporten beurteilbar. Auflösung 16/24/32 vergleichen,
Rückseiten dokumentieren und Skala von Hand setzen. Kollisionshülle, Gebäudezugang
und Höhe getrennt prüfen; der Surface-Prototyp füllt keine Innenräume und leitet
keine Begehbarkeit ab. Folgearbeit erhält das echte Objekt-Benchmark; diese
Scheibe liefert reproduzierbare Eingänge, Import/Viewer und Lizenz-/Betriebsrecherche.
