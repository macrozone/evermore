# 0008 – Gas City mit Gastown-Refinery als Merge-Queue

- Status: accepted
- Datum: 2026-10-02
- Entscheider: maw
- Löst ab: [0006](0006-pr-pro-bead-agents-mergen.md)

## Kontext und Problem

Die Umsetzung läuft über Gas City (Orchestrator auf Basis von Beads). ADR 0006 sah vor, dass jeder Agent seinen eigenen PR merged, sobald die GitHub-CI grün ist. Bei mehreren parallelen Agents führt das leicht zu Brüchen auf `main` (zwei einzeln grüne Änderungen, die zusammen nicht funktionieren), und eine CI existiert noch nicht.

## Betrachtete Optionen

- Eigene Formula gemäss ADR 0006 (PR pro Bead, Agent merged bei grüner CI)
- Gas City `mol-polecat-commit` (Worktree, lokale Checks, direkt auf `main`)
- Gastown-Pack mit Refinery als Merge-Queue

## Entscheidung

Gewählt: **Gastown-Pack mit Refinery.** Polecats setzen je ein Bead in einem eigenen Worktree auf einem Feature-Branch um und übergeben an die Refinery. Die Refinery arbeitet **einen Branch nach dem anderen** ab: Rebase auf `main`, Setup/Typecheck/Lint/Test/Build lokal, dann Merge. Bei Konflikten oder roten Tests geht das Bead mit Begründung zurück in den Pool.

- Merge-Strategie vorerst `direct` (Refinery merged selbst nach `main`).
- Die GitHub-CI (catladder) ist **optional**: Sie läuft und liefert Review-Apps, ist aber keine Voraussetzung für den Merge. Kein Branch-Schutz, der Pushes der Refinery verhindert.
- Später möglich: Strategie `pr` (Refinery eröffnet GitHub-PRs) kombiniert mit GitHub-Auto-Merge.

## Konsequenzen

- Positiv: geordnete Merges ohne gegenseitiges Kaputtmachen; Menschen müssen nicht mergen; schont lokale Ressourcen (nur die Refinery testet vollständig).
- Negativ: zusätzliche, dauerhaft laufende Agents (Mayor, Deacon, Witness, Refinery) kosten Tokens; Qualität hängt an den lokalen Checks der Refinery; komplexes Pack, Fehlersuche aufwendiger.
- Bead wird von der Refinery nach dem Merge geschlossen.
- Experimentell für evermore; nach einigen Epics bewerten.
