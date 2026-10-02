# 0009 – Produktvision als lebendes Dokument, Ideen als Beads

- Status: accepted
- Datum: 2026-10-02
- Entscheider: maw

## Kontext und Problem

Evermore soll organisch um eine Vision wachsen, und Agents sollen eigene Ideen und Inspirationen einbringen dürfen. Es braucht einen Ort für die Vision und einen Weg, wie Ideen gesammelt und entschieden werden, ohne dass Agents sie eigenmächtig umsetzen.

## Betrachtete Optionen

- Vision und Ideen nur in Beads (Epics, Memories)
- Vision als Dokument im Repo, Ideen als Abschnitt im Dokument
- Vision als Dokument im Repo, Ideen als zurückgestellte Beads mit Label `idee`

## Entscheidung

Gewählt: **Vision als lebendes Dokument [`docs/vision.md`](../vision.md), Ideen als Beads mit Label `idee`, zurückgestellt (`bd defer`) bis maw entscheidet.**

- Angenommene Ideen fliessen in `docs/vision.md` ein und werden bei Bedarf zu Epics/Beads; abgelehnte werden mit Begründung geschlossen.
- Agents dürfen in Experimenten (`/lab`) eigene Ansätze ausprobieren; Ideen über die eigene Aufgabe hinaus erfassen sie als Idee-Bead (Regeln in `AGENTS.md`, «Ideen einbringen»).
- `bd remember produktvision` bleibt eine Kurzfassung mit Verweis auf das Dokument.

## Konsequenzen

- Positiv: Vision versioniert und für alle lesbar; Ideen sind sichtbar (Scotty), aber werden nicht automatisch umgesetzt; abgelehnte Ideen dokumentieren, was Evermore nicht ist.
- Negativ: Der Ideenpool kann wachsen und braucht regelmässige Sichtung durch maw.
