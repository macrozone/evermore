# 0001 – Entscheidungen als ADR festhalten

- Status: accepted
- Datum: 2026-10-02
- Entscheider: maw

## Kontext und Problem

Evermore wird grösstenteils von Coding-Agents umgesetzt, die in getrennten Sessions arbeiten und nur sehen, was im Repo oder in Beads steht. Entscheidungen, die nur in einem Chat oder im Kopf existieren, gehen verloren oder werden von Agents unbewusst unterlaufen.

## Betrachtete Optionen

- Entscheidungen nur in Beads (Kommentare, Design-Notes)
- ADRs im Repo (MADR), Beads verweisen darauf
- Externes Wiki

## Entscheidung

Gewählt: **ADRs im Repo** unter `docs/adr/` im MADR-Format. Sie sind versioniert, im PR reviewbar und für jeden Agent im Worktree lesbar. Beads bleiben der Ort für offene Fragen (`-t decision`, Label `human`) und aufgabenspezifische Details.

## Konsequenzen

- Positiv: nachvollziehbare Entscheidungen, Agents können sie vor der Arbeit lesen.
- Negativ: zusätzlicher Schritt beim Entscheiden; muss in den Agent-Richtlinien (AGENTS.md) durchgesetzt werden.
- Jede Session (auch Chat/Planung), in der entschieden wird, schreibt die Entscheidung vor dem Ende als ADR bzw. ins Bead zurück.
