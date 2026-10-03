# Test: Bildmodell zeichnet Höhenkarte zum eigenen Bild (2026-10-03)

Idee maw (Epic evermore-1fo.17): Das Bildmodell erzeugt zu einem Pixel-Art-Bild eine farbcodierte Höhenkarte, damit wir Höhen nicht raten müssen.

- Quelle: `docs/art/moodboards/02-eigene-welt/it2-waldhuette-abend.jpg` (1376×768)
- Modell: `gemini-3.1-flash-image` via Vertex AI (location `eu`), Bild-zu-Bild mit Referenzbild
- Ergebnis: `it2-waldhuette-abend.height.png` (1376×768, gleiche Grösse)
- Kosten: ca. 1'240 Input- und 1'730 Output-Tokens (1 Bild)

## Prompt

> Create a HEIGHT MAP for this exact top-down pixel-art game scene. Same framing, same size, same layout, pixel-aligned to the input. Encode height as flat grayscale steps: black = water (lowest), dark gray = ground/grass, mid gray = paths, fences and low objects (knee height), light gray = walls and tree trunks (one storey), near-white = roofs and tree crowns, white = chimney/highest points. No shading, no lighting, no texture, no outlines, no text - only flat gray regions with hard edges matching the objects in the input image.

## Beobachtungen

- **Deckungsgleich:** Layout, Objekte und Kanten liegen sehr genau auf dem Original (Haus, Zaun, Bach, Brücke, Bäume).
- **Höhenlogik stimmt grob:** Wasser schwarz (tiefstes), Boden dunkel, Wege/Zaun mittel, Dächer und Baumkronen hell.
- **Nicht flach:** Das Modell hat eher eine Graustufen-Version mit Texturen gezeichnet als saubere Höhenstufen. Für Voxel braucht es eine Nachbearbeitung (Quantisierung pro Tile auf die Stufen, Glättung) oder einen strengeren Prompt / zweiten Durchgang.
- Fassaden (Hauswand vorne) sind teils so hell wie Dächer – in Draufsicht ist «Höhe» bei Fassaden mehrdeutig; Fassaden sollten eher aus der Kante Dach→Boden abgeleitet werden.

Fazit: vielversprechend als Quelle für Höhen; für den Prototyp evermore-1fo.17.2 mit Quantisierung testen.
